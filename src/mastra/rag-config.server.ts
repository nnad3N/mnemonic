import type { VectorApi } from "@/lib/vector-kit.server";
import { EMBEDDING_DIMENSION } from "@/mastra/models.server";

/** Physical index name; includes the embedder id so model changes reindex into a new index. */
export const FILE_EMBEDDINGS_INDEX = "file_embeddings_v001";

export const FILE_EMBEDDINGS_INDEX_CONFIG = {
  dimension: EMBEDDING_DIMENSION,
  indexConfig: { type: "hnsw" },
  indexName: FILE_EMBEDDINGS_INDEX,
} satisfies Parameters<VectorApi["createIndex"]>[0];
