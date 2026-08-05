import { createVectorQueryTool } from "@mastra/rag";

import { FILE_EMBEDDINGS_INDEX, fileEmbeddingModel } from "@/mastra/file-rag-config";

import { VECTOR_STORE_NAME } from "../storage";

export const fileVectorSearchTool = createVectorQueryTool({
  description: [
    "Semantic search over extracted text from uploads in the current topic.",
    "If results are too narrow or the answer spans multiple files, try fileGraphRag next.",
  ].join(" "),
  enableFilter: true,
  id: "file-vector-search",
  indexName: FILE_EMBEDDINGS_INDEX,
  model: fileEmbeddingModel,
  vectorStoreName: VECTOR_STORE_NAME,
});
