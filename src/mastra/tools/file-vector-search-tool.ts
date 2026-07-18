import { createVectorQueryTool } from "@mastra/rag";

import { FILE_EMBEDDINGS_INDEX, fileEmbeddingModel } from "@/mastra/file-rag-config";

import { VECTOR_STORE_NAME } from "../storage";

export const fileVectorSearchTool = createVectorQueryTool({
  description: [
    "Semantic search over extracted text from uploads in the current topic.",
    "Use first for direct facts, quotes, definitions, dates, or specific passages in indexed PDFs, office documents, and other text-extracted files.",
    "Do not use for images or raw binary inspection; use getFileFromS3 for supported image inspection.",
    "If results are too narrow or the answer spans multiple files, try fileGraphRag next.",
    "Results are scoped to the current topic and may be partial excerpts, not complete documents.",
  ].join(" "),
  enableFilter: true,
  id: "file-vector-search",
  indexName: FILE_EMBEDDINGS_INDEX,
  model: fileEmbeddingModel,
  vectorStoreName: VECTOR_STORE_NAME,
});
