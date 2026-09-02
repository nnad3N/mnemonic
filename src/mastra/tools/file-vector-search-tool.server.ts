import { createVectorQueryTool } from "@mastra/rag";

import { FILE_EMBEDDINGS_INDEX, getRagEmbeddingModel } from "@/mastra/rag-config.server";

import { VECTOR_STORE_NAME } from "../storage.server";

export const createFileVectorSearchTool = (apiKey: string) =>
  createVectorQueryTool({
    description:
      "Cosine similarity over embedded 512-character chunks of the current topic's files; each hit carries the file name and page.",
    id: "file-vector-search",
    indexName: FILE_EMBEDDINGS_INDEX,
    model: getRagEmbeddingModel(apiKey),
    vectorStoreName: VECTOR_STORE_NAME,
  });
