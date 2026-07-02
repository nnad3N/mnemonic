import { createVectorQueryTool } from "@mastra/rag";

import {
  RESOURCE_EMBEDDINGS_INDEX,
  resourceEmbeddingModel,
} from "@/mastra/resource-rag-config";

import { PG_VECTOR_STORE_NAME } from "../storage";

export const resourceVectorSearchTool = createVectorQueryTool({
  description: [
    "Semantic search over extracted text from uploads in the current topic.",
    "Use first for direct facts, quotes, definitions, dates, or specific passages in indexed PDFs, office documents, and other text-extracted files.",
    "Do not use for images or raw binary inspection; use getResourceFromS3 for supported image inspection.",
    "If results are too narrow or the answer spans multiple files, try resourceGraphRag next.",
    "Input queryText should contain the user's question or targeted search terms. Results are scoped to the current topic and may be partial excerpts, not complete documents.",
  ].join(" "),
  enableFilter: true,
  id: "resource-vector-search",
  indexName: RESOURCE_EMBEDDINGS_INDEX,
  model: resourceEmbeddingModel,
  vectorStoreName: PG_VECTOR_STORE_NAME,
});
