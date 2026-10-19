"use node";

import { NonRetryableError } from "@convex-dev/workpool";
import { v } from "convex/values";
import { extractText, getDocumentProxy } from "unpdf";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { chunkText } from "./model/documents";
import { embedDocuments } from "./model/embeddings";

// Chunks embedded per Gemini request and saved per mutation.
const EMBED_BATCH = 50;

/**
 * One document: extract text → chunk → embed → save. Runs on the
 * documentPool Workpool, which retries it with backoff; every step can run
 * again safely because startEmbedding clears earlier chunks.
 */
export const process = internalAction({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const claimed = await ctx.runMutation(internal.documents.claim, { documentId });
    if (claimed === null) return;

    const blob = await ctx.storage.get(claimed.storageId);
    if (blob === null) {
      throw new NonRetryableError("The uploaded file is gone");
    }

    let text: string;
    let pageCount: number;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()));
      const extracted = await extractText(pdf, { mergePages: true });
      text = extracted.text;
      pageCount = extracted.totalPages;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new NonRetryableError(`Not a readable PDF: ${reason}`);
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new NonRetryableError("No text found (is it a scanned PDF without OCR?)");
    }

    await ctx.runMutation(internal.documents.startEmbedding, { documentId, text, pageCount });
    for (let start = 0; start < chunks.length; start += EMBED_BATCH) {
      const batch = chunks.slice(start, start + EMBED_BATCH);
      const { embeddings } = await embedDocuments(batch);
      await ctx.runMutation(internal.documents.addChunks, {
        documentId,
        chunks: batch.map((chunk, i) => ({
          chunkIndex: start + i,
          text: chunk,
          embedding: embeddings[i],
        })),
      });
    }
    await ctx.runMutation(internal.documents.finish, { documentId, chunkCount: chunks.length });
  },
});
