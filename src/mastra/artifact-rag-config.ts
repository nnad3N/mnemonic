import { gateway } from "ai";

import { models } from "@/mastra/models";

export const ARTIFACT_EMBEDDINGS_INDEX = "artifact_embeddings";
export const ARTIFACT_EMBEDDING_DIMENSION = 1536;

export const artifactEmbeddingModel = gateway.embeddingModel(models.embedding);
