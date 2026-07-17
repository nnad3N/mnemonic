import { createGraphRAGTool } from "@mastra/rag";

import {
  FILE_EMBEDDING_DIMENSION,
  FILE_EMBEDDINGS_INDEX,
  fileEmbeddingModel,
} from "@/mastra/file-rag-config";

import { PG_VECTOR_STORE_NAME } from "../storage";

export const fileGraphRagTool = createGraphRAGTool({
  description: [
    "Graph-based retrieval over text-indexed uploads in the current topic.",
    "Use when the answer likely depends on relationships, connected passages, or evidence spread across multiple uploaded files.",
    "Prefer fileVectorSearch first for direct facts, quotes, or specific passages unless the question clearly requires cross-document connections.",
    "Do not use for images, binary inspection, or loading a raw file; use getFileFromS3 for supported image inspection.",
    "Results are scoped to the current topic.",
  ].join(" "),
  enableFilter: true,
  graphOptions: {
    dimension: FILE_EMBEDDING_DIMENSION,
    threshold: 0.7,
  },
  id: "file-graph-rag",
  indexName: FILE_EMBEDDINGS_INDEX,
  model: fileEmbeddingModel,
  vectorStoreName: PG_VECTOR_STORE_NAME,
});
