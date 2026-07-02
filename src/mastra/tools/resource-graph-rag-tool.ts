import { createGraphRAGTool } from "@mastra/rag";

import {
  RESOURCE_EMBEDDING_DIMENSION,
  RESOURCE_EMBEDDINGS_INDEX,
  resourceEmbeddingModel,
} from "@/mastra/resource-rag-config";

import { PG_VECTOR_STORE_NAME } from "../storage";

export const resourceGraphRagTool = createGraphRAGTool({
  description: [
    "Graph-based retrieval over text-indexed uploads in the current topic.",
    "Use when the answer likely depends on relationships, connected passages, or evidence spread across multiple uploaded files.",
    "Prefer resource-vector-search first for direct facts, quotes, or specific passages unless the question clearly requires cross-document connections.",
    "Do not use for images, binary inspection, or loading a raw file; use get-resource-from-s3 for supported image inspection.",
    "Input queryText should contain the user's question or targeted search terms. Results are scoped to the current topic.",
  ].join(" "),
  enableFilter: true,
  graphOptions: {
    dimension: RESOURCE_EMBEDDING_DIMENSION,
    threshold: 0.7,
  },
  id: "resource-graph-rag",
  indexName: RESOURCE_EMBEDDINGS_INDEX,
  model: resourceEmbeddingModel,
  vectorStoreName: PG_VECTOR_STORE_NAME,
});
