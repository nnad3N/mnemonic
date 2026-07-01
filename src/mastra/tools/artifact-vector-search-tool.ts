import { createVectorQueryTool } from "@mastra/rag";

import {
  ARTIFACT_EMBEDDINGS_INDEX,
  artifactEmbeddingModel,
} from "@/mastra/artifact-rag-config";

import { PG_VECTOR_STORE_NAME } from "../storage";

export const artifactVectorSearchTool = createVectorQueryTool({
  description: [
    "Semantic search over extracted text from uploads in the current topic.",
    "Use first for direct facts, quotes, definitions, dates, or specific passages in indexed PDFs, office documents, and other text-extracted files.",
    "Do not use for images or raw binary inspection; use get-artifact-from-s3 for supported image inspection.",
    "If results are too narrow or the answer spans multiple files, try artifact-graph-rag next.",
    "Input queryText should contain the user's question or targeted search terms. Results are scoped to the current topic and may be partial excerpts, not complete documents.",
  ].join(" "),
  enableFilter: true,
  id: "artifact-vector-search",
  indexName: ARTIFACT_EMBEDDINGS_INDEX,
  model: artifactEmbeddingModel,
  vectorStoreName: PG_VECTOR_STORE_NAME,
});
