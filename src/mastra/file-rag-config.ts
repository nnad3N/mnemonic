import { FILE_EMBEDDING_DIMENSION, models } from "@/mastra/models";

export { FILE_EMBEDDING_DIMENSION };

/** Physical index name; includes embedder id so model changes can reindex into a new index. */
export const FILE_EMBEDDINGS_INDEX = "file_embeddings_v001";

const createTestFileEmbeddingModel = async () => {
  const { MockEmbeddingModelV3 } = await import("ai/test");
  /** Non-zero unit vector — cosine similarity of the zero vector is undefined and filters out. */
  const unitVector = Array.from({ length: FILE_EMBEDDING_DIMENSION }, (_, index) =>
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
};

export const fileEmbeddingModel =
  process.env.VITEST === "true" ? await createTestFileEmbeddingModel() : models.embedding;
