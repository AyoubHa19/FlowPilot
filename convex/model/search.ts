import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";

export type ChunkHit = {
  chunkId: Id<"docChunks">;
  documentId: Id<"documents">;
  filename: string;
  chunkIndex: number;
  text: string;
  score: number;
};

/**
 * Vector search restricted to one tenant's chunks. The filter runs inside the
 * index, so another tenant's lease can never be returned. Shared by the
 * dashboard search box and (Stage 5) the agent's search_lease_documents tool.
 */
export async function searchTenantChunks(
  ctx: ActionCtx,
  tenantId: Id<"tenants">,
  vector: number[],
  limit = 5,
): Promise<ChunkHit[]> {
  const hits = await ctx.vectorSearch("docChunks", "by_embedding", {
    vector,
    limit,
    filter: (q) => q.eq("tenantId", tenantId),
  });
  if (hits.length === 0) return [];
  const chunks = await ctx.runQuery(internal.documents.chunksForHits, {
    ids: hits.map((h) => h._id),
  });
  const scores = new Map(hits.map((h) => [h._id, h._score]));
  return chunks
    .map((c) => ({ ...c, score: scores.get(c.chunkId) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}
