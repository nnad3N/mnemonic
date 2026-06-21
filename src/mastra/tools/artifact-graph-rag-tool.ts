import { createGraphRAGTool } from "@mastra/rag";

import {
  ARTIFACT_EMBEDDING_DIMENSION,
  ARTIFACT_EMBEDDINGS_INDEX,
  artifactEmbeddingModel,
} from "@/mastra/artifact-rag-config";

import { PG_VECTOR_STORE_NAME } from "../storage";

export const artifactGraphRagTool = createGraphRAGTool({
  description: [
    "Graph-based search over text-indexed uploads in the current topic.",
    "Use when artifact-vector-search is insufficient: answers span multiple files, connected passages matter, or relationships between concepts are important.",
    "Do NOT use for images or raw file inspection — use get-artifact-from-s3 for those.",
    "Try artifact-vector-search first unless the question clearly requires cross-document connections.",
    "Input: queryText with the user's question or search terms.",
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
