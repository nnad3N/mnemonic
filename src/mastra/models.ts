import { defaultEmbeddingSettingsMiddleware, wrapEmbeddingModel } from "ai";

import { google } from "@/mastra/google";

export const ARTIFACT_EMBEDDING_DIMENSION = 1536;

const baseEmbedding = google.embedding("gemini-embedding-2");

const embedding = wrapEmbeddingModel({
  middleware: defaultEmbeddingSettingsMiddleware({
    settings: {
      providerOptions: {
        google: {
          outputDimensionality: ARTIFACT_EMBEDDING_DIMENSION,
        },
      },
    },
  }),
  model: baseEmbedding,
});

export const models = {
  embedding,
  mnemonicAgent: google("gemini-3.1-flash-lite"),
  observationalMemory: google("gemini-3.1-flash-lite"),
  threadTitle: google("gemma-4-26b-a4b-it"),
} as const;
