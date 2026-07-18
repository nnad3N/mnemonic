import { FILE_EMBEDDING_DIMENSION, models } from "@/mastra/models";

export { FILE_EMBEDDING_DIMENSION };

/** Physical index name; includes embedder id so model changes can reindex into a new index. */
export const FILE_EMBEDDINGS_INDEX = "file_embeddings_v1";

export const fileEmbeddingModel = models.embedding;
