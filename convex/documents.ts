import { vOnCompleteArgs, Workpool } from "@convex-dev/workpool";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import { requireUserId } from "./lib/auth";
import {
  emailFromFilename,
  linkDocumentToTenant,
  MAX_PDF_BYTES,
  MAX_STORED_TEXT_CHARS,
} from "./model/documents";
import { embedQuery } from "./model/embeddings";
import { findTenantByEmail } from "./model/properties";
import { searchTenantChunks } from "./model/search";

// Low parallelism keeps us inside Gemini's free-tier rate limits.
const documentPool = new Workpool(components.documentPool, { maxParallelism: 3 });

// 1 try + 3 retries with exponential backoff (PRD guardrail for LLM calls).
const PROCESS_RETRY = { maxAttempts: 4, initialBackoffMs: 2_000, base: 2 };

const MAX_QUERY_CHARS = 500;

// --- Public API ------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Registers an uploaded PDF, links it to a tenant when the filename is
 * lease-<email>.pdf, and queues one background job to process it.
 */
export const create = mutation({
  args: { storageId: v.id("_storage"), filename: v.string() },
  handler: async (ctx, { storageId, filename }) => {
    await requireUserId(ctx);
    const file = await ctx.db.system.get(storageId);
    if (file === null) {
      throw new ConvexError("Upload not found");
    }
    if (!filename.toLowerCase().endsWith(".pdf")) {
      await ctx.storage.delete(storageId);
      throw new ConvexError(`${filename}: only PDF files are supported`);
    }
    if (file.size > MAX_PDF_BYTES) {
      await ctx.storage.delete(storageId);
      throw new ConvexError(`${filename}: larger than 20 MB`);
    }

    const documentId = await ctx.db.insert("documents", {
      storageId,
      filename,
      kind: "other",
      status: "queued",
      chunkCount: 0,
    });
    const email = emailFromFilename(filename);
    const tenant = email ? await findTenantByEmail(ctx, email) : null;
    if (tenant) {
      await linkDocumentToTenant(ctx, documentId, tenant._id);
    }

    await enqueueProcessing(ctx, documentId);
    return documentId;
  },
});

async function enqueueProcessing(ctx: MutationCtx, documentId: Id<"documents">) {
  await documentPool.enqueueAction(
    ctx,
    internal.documentsNode.process,
    { documentId },
    {
      retry: PROCESS_RETRY,
      onComplete: internal.documents.processFailed,
      onCompleteExcludeKinds: ["success"],
      context: { documentId },
    },
  );
}

/**
 * Re-processes every document, e.g. after changing the chunker or the
 * embedding model. Pages through the table so it scales:
 *
 *   npx convex run documents:reindex
 */
export const reindex = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("documents")
      .paginate({ numItems: 50, cursor: cursor ?? null });
    for (const doc of page.page) {
      await ctx.db.patch(doc._id, { status: "queued", error: undefined });
      await enqueueProcessing(ctx, doc._id);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.documents.reindex, { cursor: page.continueCursor });
    }
    return page.page.length;
  },
});

/** Newest first, with the linked tenant's name. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    await requireUserId(ctx);
    const result = await ctx.db.query("documents").order("desc").paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async ({ text: _text, ...doc }) => {
        const tenant = doc.tenantId ? await ctx.db.get(doc.tenantId) : null;
        return { ...doc, tenant: tenant && { _id: tenant._id, name: tenant.name } };
      }),
    );
    return { ...result, page };
  },
});

export const listForTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    await requireUserId(ctx);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();
    return docs.map(({ text: _text, ...doc }) => doc);
  },
});

/** Manual link for files that did not follow the naming pattern. */
export const linkTenant = mutation({
  args: { documentId: v.id("documents"), tenantEmail: v.string() },
  handler: async (ctx, { documentId, tenantEmail }) => {
    await requireUserId(ctx);
    const tenant = await findTenantByEmail(ctx, tenantEmail);
    if (tenant === null) {
      throw new ConvexError(`No tenant with email ${tenantEmail.trim()}`);
    }
    if ((await ctx.db.get(documentId)) === null) {
      throw new ConvexError("Document not found");
    }
    await linkDocumentToTenant(ctx, documentId, tenant._id);
    return tenant.name;
  },
});

/** Semantic search over one tenant's documents. */
export const search = action({
  args: { tenantId: v.id("tenants"), query: v.string() },
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const question = args.query.trim();
    if (question === "" || question.length > MAX_QUERY_CHARS) {
      throw new ConvexError(`Ask a question of 1 to ${MAX_QUERY_CHARS} characters`);
    }
    return await searchTenantChunks(ctx, args.tenantId, await embedQuery(question));
  },
});

/** Same search with a ready-made vector (tests, and callers that embed themselves). */
export const searchByVector = internalAction({
  args: { tenantId: v.id("tenants"), vector: v.array(v.float64()), limit: v.optional(v.number()) },
  handler: async (ctx, { tenantId, vector, limit }) =>
    await searchTenantChunks(ctx, tenantId, vector, limit),
});

// --- Background processing (see documentsNode.ts) -------------------------

/**
 * Marks the document as being worked on and returns what the action needs.
 * Returns null for a document that is already ready, so a duplicate run
 * does nothing. Earlier states are reclaimed: that is a retry.
 */
export const claim = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    if (doc === null || doc.status === "ready") {
      return null;
    }
    await ctx.db.patch(documentId, { status: "extracting", error: undefined });
    return { storageId: doc.storageId };
  },
});

/** Stores the text and drops chunks from any earlier attempt. */
export const startEmbedding = internalMutation({
  args: { documentId: v.id("documents"), text: v.string(), pageCount: v.number() },
  handler: async (ctx, { documentId, text, pageCount }) => {
    const old = await ctx.db
      .query("docChunks")
      .withIndex("by_document", (q) => q.eq("documentId", documentId))
      .collect();
    for (const chunk of old) {
      await ctx.db.delete(chunk._id);
    }
    await ctx.db.patch(documentId, {
      status: "embedding",
      text: text.slice(0, MAX_STORED_TEXT_CHARS),
      pageCount,
      chunkCount: 0,
    });
  },
});

export const addChunks = internalMutation({
  args: {
    documentId: v.id("documents"),
    chunks: v.array(
      v.object({ chunkIndex: v.number(), text: v.string(), embedding: v.array(v.float64()) }),
    ),
  },
  handler: async (ctx, { documentId, chunks }) => {
    const doc = await ctx.db.get(documentId);
    if (doc === null) return;
    for (const chunk of chunks) {
      // tenantId is read here, at write time, so a link made while the file
      // was processing still reaches every chunk.
      await ctx.db.insert("docChunks", { documentId, tenantId: doc.tenantId, ...chunk });
    }
  },
});

export const finish = internalMutation({
  args: { documentId: v.id("documents"), chunkCount: v.number() },
  handler: async (ctx, { documentId, chunkCount }) => {
    await ctx.db.patch(documentId, { status: "ready", chunkCount });
  },
});

/** Runs once all retries are used up (or the job was canceled). */
export const processFailed = internalMutation({
  args: vOnCompleteArgs(v.object({ documentId: v.id("documents") })),
  handler: async (ctx, { context, result }) => {
    const error = result.kind === "failed" ? result.error : "Processing was canceled";
    await ctx.db.patch(context.documentId, { status: "failed", error });
  },
});

export const chunksForHits = internalQuery({
  args: { ids: v.array(v.id("docChunks")) },
  handler: async (ctx, { ids }) => {
    const hits = [];
    for (const id of ids) {
      const chunk = await ctx.db.get(id);
      const doc = chunk && (await ctx.db.get(chunk.documentId));
      if (chunk && doc) {
        hits.push({
          chunkId: chunk._id,
          documentId: doc._id,
          filename: doc.filename,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
        });
      }
    }
    return hits;
  },
});
