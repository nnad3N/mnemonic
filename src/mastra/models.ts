import { openrouter } from "@/mastra/openrouter";

/** Qwen3 Embedding 8B native output size. */
export const FILE_EMBEDDING_DIMENSION = 4096;

const chatModel = openrouter("xiaomi/mimo-v2.5");

export const models = {
  embedding: openrouter.textEmbeddingModel("qwen/qwen3-embedding-8b"),
  conversationAgent: chatModel,
  topicAgent: chatModel,
  observationalMemory: chatModel,
  threadTitle: chatModel,
} as const;
