import { createGraphRAGTool } from "@mastra/rag";

import { FILE_EMBEDDINGS_INDEX, getFileEmbeddingModel } from "@/mastra/file-rag-config.server";
import { FILE_EMBEDDING_DIMENSION } from "@/mastra/file-rag-config.server";

import { VECTOR_STORE_NAME } from "../storage.server";

export const createFileGraphRagTool = (apiKey: string) =>
  createGraphRAGTool({
    description:
      "Graph-based retrieval over extracted text from uploads in the current topic, connecting related passages across files.",
    enableFilter: true,
    graphOptions: {
      dimension: FILE_EMBEDDING_DIMENSION,
      threshold: 0.7,
    },
    id: "file-graph-rag",
    indexName: FILE_EMBEDDINGS_INDEX,
    model: getFileEmbeddingModel(apiKey),
    vectorStoreName: VECTOR_STORE_NAME,
  });
