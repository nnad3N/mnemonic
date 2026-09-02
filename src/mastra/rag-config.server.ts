import { MockEmbeddingModelV3 } from "ai/test";

import type { VectorApi } from "@/lib/vector-kit.server";
import { getEmbeddingModel } from "@/mastra/config.server";

/** Physical index name; includes the embedder id so model changes reindex into a new index. */
export const FILE_EMBEDDINGS_INDEX = "file_embeddings_v001";

/** Qwen3 Embedding 8B native output size. */
export const EMBEDDING_DIMENSION = 4096;

// flat = exact scan: pgvector caps ANN indexes (ivfflat/hnsw) at 2000 dimensions,
// below the embedder's 4096. Fine for one user's files, and recall is perfect.
export const FILE_EMBEDDINGS_INDEX_CONFIG = {
  dimension: EMBEDDING_DIMENSION,
  indexConfig: { type: "flat" },
  indexName: FILE_EMBEDDINGS_INDEX,
} satisfies Parameters<VectorApi["createIndex"]>[0];

export const getRagEmbeddingModel = (apiKey: string) => {
  if (process.env.VITEST === "true") {
    /** Non-zero unit vector — cosine similarity of the zero vector is undefined and filters out. */
    const unitVector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) =>
      index === 0 ? 1 : 0,
    );

    return new MockEmbeddingModelV3({
      maxEmbeddingsPerCall: 2048,
      doEmbed: async ({ values }) =>
        Promise.resolve({
          embeddings: values.map(() => unitVector),
          usage: { tokens: values.length },
          warnings: [],
        }),
    });
  }
  return getEmbeddingModel(apiKey);
};
