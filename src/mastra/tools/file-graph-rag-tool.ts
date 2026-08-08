import { createGraphRAGTool } from "@mastra/rag";

import {
  FILE_EMBEDDING_DIMENSION,
  FILE_EMBEDDINGS_INDEX,
  fileEmbeddingModel,
} from "@/mastra/file-rag-config";

import { VECTOR_STORE_NAME } from "../storage";

export const fileGraphRagTool = createGraphRAGTool({
  description:
    "Graph-based retrieval over extracted text from uploads in the current topic, connecting related passages across files.",
  enableFilter: true,
  graphOptions: {
    dimension: FILE_EMBEDDING_DIMENSION,
    threshold: 0.7,
  },
  id: "file-graph-rag",
  indexName: FILE_EMBEDDINGS_INDEX,
  model: fileEmbeddingModel,
  vectorStoreName: VECTOR_STORE_NAME,
});
