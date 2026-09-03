import { MockEmbeddingModelV3, MockLanguageModelV3 } from "ai/test";

import type { VectorApi } from "@/lib/vector-kit.server";
import { getEmbeddingModel, getFileDescriptionModel } from "@/mastra/config.server";
import { EMBEDDING_DIMENSION } from "@/mastra/models.server";

/** Physical index name; includes the embedder id so model changes reindex into a new index. */
export const FILE_EMBEDDINGS_INDEX = "file_embeddings_v001";

export const FILE_EMBEDDINGS_INDEX_CONFIG = {
  dimension: EMBEDDING_DIMENSION,
  indexConfig: { type: "hnsw" },
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

export const getRagDescriptionModel = (apiKey: string) => {
  if (process.env.VITEST === "true") {
    return new MockLanguageModelV3({
      doGenerate: async () =>
        Promise.resolve({
          content: [{ type: "text", text: "A sample document about the mnemonic RAG pipeline." }],
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 0, text: 0, reasoning: 0 },
          },
          warnings: [],
        }),
    });
  }
  return getFileDescriptionModel(apiKey);
};
