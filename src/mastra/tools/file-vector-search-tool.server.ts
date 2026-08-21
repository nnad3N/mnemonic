import { createVectorQueryTool } from "@mastra/rag";

import { FILE_EMBEDDINGS_INDEX, getRagEmbeddingModel } from "@/mastra/rag-config.server";

import { VECTOR_STORE_NAME } from "../storage.server";

export const createFileVectorSearchTool = (apiKey: string) =>
  createVectorQueryTool({
    description: "Semantic search over extracted text from uploads in the current topic.",
    enableFilter: true,
    id: "file-vector-search",
    indexName: FILE_EMBEDDINGS_INDEX,
    model: getRagEmbeddingModel(apiKey),
    vectorStoreName: VECTOR_STORE_NAME,
  });
