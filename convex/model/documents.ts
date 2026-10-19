import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "./properties";

export const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Extracted text kept on the document for display; chunks hold all of it. */
export const MAX_STORED_TEXT_CHARS = 500_000;

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;

/** "lease-felix.braun@example.com.pdf" → "felix.braun@example.com". */
export function emailFromFilename(filename: string): string | null {
  const match = /^lease[-_ ](.+@.+\..+)\.pdf$/i.exec(filename.trim());
  return match ? normalizeEmail(match[1]) : null;
}

/** Collapses runs of spaces but keeps paragraph breaks. */
export function normalizeText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits on sentence ends, keeping the punctuation. */
function sentences(paragraph: string) {
  return paragraph.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

/** Pieces no longer than `size`: paragraphs, else sentences, else hard cuts. */
function pieces(text: string, size: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n\n/)) {
    if (paragraph.length <= size) {
      out.push(paragraph);
      continue;
    }
    for (const sentence of sentences(paragraph)) {
      for (let i = 0; i < sentence.length; i += size) {
        out.push(sentence.slice(i, i + size));
      }
    }
  }
  return out.filter((p) => p.trim().length > 0);
}

/** The last ~`overlap` characters of a chunk, starting at a word boundary. */
function tail(chunk: string, overlap: number) {
  if (chunk.length <= overlap) return chunk;
  const cut = chunk.slice(-overlap);
  const space = cut.indexOf(" ");
  return space === -1 ? cut : cut.slice(space + 1);
}

/**
 * Packs paragraphs into chunks of at most `size` characters. Each chunk after
 * the first starts with the end of the previous one, so a sentence that spans
 * a boundary is still found whole in one chunk.
 */
export function chunkText(raw: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const text = normalizeText(raw);
  if (text === "") return [];
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces(text, size - overlap)) {
    const joined = current === "" ? piece : `${current}\n\n${piece}`;
    if (joined.length <= size) {
      current = joined;
      continue;
    }
    chunks.push(current);
    current = `${tail(current, overlap)}\n\n${piece}`;
  }
  if (current !== "") chunks.push(current);
  return chunks;
}

/**
 * Links a document to a tenant (and their active lease), and copies the
 * tenantId onto every chunk so vector search can filter by tenant.
 */
export async function linkDocumentToTenant(
  ctx: MutationCtx,
  documentId: Id<"documents">,
  tenantId: Id<"tenants"> | undefined,
) {
  const leases = tenantId
    ? await ctx.db
        .query("leases")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect()
    : [];
  const lease = leases.find((l) => l.status === "active") ?? null;

  await ctx.db.patch(documentId, {
    tenantId,
    leaseId: lease?._id,
    kind: lease ? "lease" : "other",
  });
  if (lease && lease.documentId !== documentId) {
    await ctx.db.patch(lease._id, { documentId });
  }

  const chunks = await ctx.db
    .query("docChunks")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();
  for (const chunk of chunks) {
    if (chunk.tenantId !== tenantId) {
      await ctx.db.patch(chunk._id, { tenantId });
    }
  }
}
