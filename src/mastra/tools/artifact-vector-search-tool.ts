import { createVectorQueryTool } from "@mastra/rag";

import {
  ARTIFACT_EMBEDDINGS_INDEX,
  artifactEmbeddingModel,
} from "@/mastra/artifact-rag-config";

import { PG_VECTOR_STORE_NAME } from "../storage";

export const artifactVectorSearchTool = createVectorQueryTool({
  description: [
    "Semantic search over text-indexed content from uploads in the current topic.",
    "Use first for direct facts, quotes, or specific passages.",
    "Works on extracted text from PDFs, office documents, and other indexed file types.",
    "Do NOT use for images — use get-artifact-from-s3 instead.",
    "If results are insufficient, try artifact-graph-rag before get-artifact-from-s3.",
    "Input: queryText with the user's question or search terms.",
  ].join(" "),
  enableFilter: true,
  id: "artifact-vector-search",
  indexName: ARTIFACT_EMBEDDINGS_INDEX,
  model: artifactEmbeddingModel,
  vectorStoreName: PG_VECTOR_STORE_NAME,
});
