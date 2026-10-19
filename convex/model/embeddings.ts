import { google } from "@ai-sdk/google";
import { embed, embedMany } from "ai";

// Gemini embeddings via the Vercel AI SDK. Reads GOOGLE_GENERATIVE_AI_API_KEY
// from the Convex environment. Must match the docChunks vector index.
export const EMBEDDING_MODEL = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 768;

const model = google.textEmbeddingModel(EMBEDDING_MODEL);

export function assertEmbeddingKey() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY is not set on this Convex deployment",
    );
  }
}

/** Embeds document chunks. The SDK batches the request and retries twice. */
export async function embedDocuments(texts: string[]) {
  assertEmbeddingKey();
  const { embeddings, usage } = await embedMany({
    model,
    values: texts,
    maxParallelCalls: 2,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" },
    },
  });
  return { embeddings, tokens: usage.tokens };
}

/** Embeds a search question (asymmetric retrieval: query side). */
export async function embedQuery(text: string) {
  assertEmbeddingKey();
  const { embedding } = await embed({
    model,
    value: text,
    providerOptions: {
      google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: "RETRIEVAL_QUERY" },
    },
  });
  return embedding;
}
