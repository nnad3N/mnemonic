import { createGraphRAGTool } from "@mastra/rag";

import { FILE_EMBEDDINGS_INDEX, getRagEmbeddingModel } from "@/mastra/rag-config.server";
import { EMBEDDING_DIMENSION } from "@/mastra/rag-config.server";

import { VECTOR_STORE_NAME } from "../storage.server";

export const createFileGraphRagTool = (apiKey: string) =>
  createGraphRAGTool({
    description:
      "Graph-based retrieval over extracted text from uploads in the current topic, connecting related passages across files.",
    enableFilter: true,
    graphOptions: {
      dimension: EMBEDDING_DIMENSION,
      threshold: 0.7,
    },
    id: "file-graph-rag",
    indexName: FILE_EMBEDDINGS_INDEX,
    model: getRagEmbeddingModel(apiKey),
    vectorStoreName: VECTOR_STORE_NAME,
  });
