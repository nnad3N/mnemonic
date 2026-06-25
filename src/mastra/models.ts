import { defaultEmbeddingSettingsMiddleware, wrapEmbeddingModel } from "ai";

import { google } from "@/mastra/google";

export const ARTIFACT_EMBEDDING_DIMENSION = 1536;

/** Google batchEmbedContents accepts at most 100 requests per call. */
const GEMINI_BATCH_EMBED_LIMIT = 100;

const baseEmbedding = google.embedding("gemini-embedding-2");

const embedding = wrapEmbeddingModel({
  middleware: [
    defaultEmbeddingSettingsMiddleware({
      settings: {
        providerOptions: {
          google: {
            outputDimensionality: ARTIFACT_EMBEDDING_DIMENSION,
          },
        },
      },
    }),
    {
      specificationVersion: "v3",
      overrideMaxEmbeddingsPerCall: () => GEMINI_BATCH_EMBED_LIMIT,
    },
  ],
  model: baseEmbedding,
});

export const models = {
  embedding,
  mnemonicAgent: google("gemini-3.1-flash-lite-preview"),
  observationalMemory: google("gemini-3.1-flash-lite-preview"),
  threadTitle: google("gemini-2.5-flash-lite"),
  webSearchAgent: google("gemini-3.1-flash-lite"),
} as const;
