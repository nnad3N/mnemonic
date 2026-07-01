import { createGraphRAGTool } from "@mastra/rag";

import {
  ARTIFACT_EMBEDDING_DIMENSION,
  ARTIFACT_EMBEDDINGS_INDEX,
  artifactEmbeddingModel,
} from "@/mastra/artifact-rag-config";

import { PG_VECTOR_STORE_NAME } from "../storage";

export const artifactGraphRagTool = createGraphRAGTool({
  description: [
    "Graph-based retrieval over text-indexed uploads in the current topic.",
    "Use when the answer likely depends on relationships, connected passages, or evidence spread across multiple uploaded files.",
    "Prefer artifact-vector-search first for direct facts, quotes, or specific passages unless the question clearly requires cross-document connections.",
    "Do not use for images, binary inspection, or loading a raw file; use get-artifact-from-s3 for supported image inspection.",
    "Input queryText should contain the user's question or targeted search terms. Results are scoped to the current topic.",
  ].join(" "),
  enableFilter: true,
  graphOptions: {
    dimension: ARTIFACT_EMBEDDING_DIMENSION,
    threshold: 0.7,
  },
  id: "artifact-graph-rag",
  indexName: ARTIFACT_EMBEDDINGS_INDEX,
  model: artifactEmbeddingModel,
  vectorStoreName: PG_VECTOR_STORE_NAME,
});
