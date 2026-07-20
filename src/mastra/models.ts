import { defaultEmbeddingSettingsMiddleware, wrapEmbeddingModel } from "ai";

import { google } from "@/mastra/google";

export const FILE_EMBEDDING_DIMENSION = 1536;

/** Google batchEmbedContents accepts at most 100 requests per call. */
const GEMINI_BATCH_EMBED_LIMIT = 100;

const baseEmbedding = google.embedding("gemini-embedding-2");

const embedding = wrapEmbeddingModel({
  middleware: [
    defaultEmbeddingSettingsMiddleware({
      settings: {
        providerOptions: {
          google: {
            outputDimensionality: FILE_EMBEDDING_DIMENSION,
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
  conversationAgent: google("gemini-flash-lite-latest"),
  topicAgent: google("gemini-flash-lite-latest"),
  observationalMemory: google("gemini-flash-lite-latest"),
  threadTitle: google("gemini-flash-lite-latest"),
} as const;
