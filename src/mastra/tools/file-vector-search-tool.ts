import { createVectorQueryTool } from "@mastra/rag";

import { FILE_EMBEDDINGS_INDEX, getFileEmbeddingModel } from "@/mastra/file-rag-config";

import { VECTOR_STORE_NAME } from "../storage";

export const createFileVectorSearchTool = (apiKey: string) =>
  createVectorQueryTool({
    description: "Semantic search over extracted text from uploads in the current topic.",
    enableFilter: true,
    id: "file-vector-search",
    indexName: FILE_EMBEDDINGS_INDEX,
    model: getFileEmbeddingModel(apiKey),
    vectorStoreName: VECTOR_STORE_NAME,
  });
