import { createVectorQueryTool } from "@mastra/rag";

import { getEmbeddingModel } from "@/mastra/config.server";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/rag-config.server";

import { VECTOR_STORE_NAME } from "../storage.server";

export const createFileVectorSearchTool = (apiKey: string) =>
  createVectorQueryTool({
    description:
      "Cosine similarity over embedded 512-character chunks of the current topic's files; each hit carries the file name and page.",
    id: "file-vector-search",
    indexName: FILE_EMBEDDINGS_INDEX,
    model: getEmbeddingModel(apiKey),
    vectorStoreName: VECTOR_STORE_NAME,
  });
