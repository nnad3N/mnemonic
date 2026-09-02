import type { OpenRouterChatSettings } from "@openrouter/ai-sdk-provider";

import * as Kit from "@/lib/kit";
import type { ModelOption } from "@/lib/model-option";

export const CONVERSATION_AGENT_ID = "conversation-agent";
export const TOPIC_AGENT_ID = "topic-agent";
export const READER_AGENT_ID = "reader-agent";
export const WORKER_AGENT_ID = "worker-agent";

export const ModelAgentIds = Kit.literals.from()([
  CONVERSATION_AGENT_ID,
  TOPIC_AGENT_ID,
  WORKER_AGENT_ID,
]);

export type ModelAgentId = Kit.LiteralMember<typeof ModelAgentIds>;

type ModelInputs = {
  acceptsPdf: boolean;
};

const modelInputs = {
  "google/gemini-3.8-flash": { acceptsPdf: true },
  "google/gemma-4-26b-a4b-it": { acceptsPdf: false },
  "moonshotai/kimi-k3": { acceptsPdf: false },
  "xiaomi/mimo-v2.5": { acceptsPdf: false },
  "z-ai/glm-5.3-flash": { acceptsPdf: false },
} satisfies Record<string, ModelInputs>;

export type ChatModel = keyof typeof modelInputs;

export const modelAcceptsPdf = (model: ChatModel) => modelInputs[model].acceptsPdf;

type AgentModel = {
  model: ChatModel;
  openrouter?: OpenRouterChatSettings;
};

// oxlint-disable-next-line anti-slop/no-known-value-widening
export const models: Record<ModelOption, AgentModel> = {
  research: {
    model: "z-ai/glm-5.3-flash",
  },
  analysis: {
    model: "google/gemini-3.8-flash",
    openrouter: {
      reasoning: {
        effort: "medium",
      },
    },
  },
  knowledge: {
    model: "moonshotai/kimi-k3",
  },
};

export const SUBAGENT_MODEL: ChatModel = "z-ai/glm-5.3-flash";
export const OBSERVATIONAL_MEMORY_MODEL: ChatModel = "xiaomi/mimo-v2.5";
export const THREAD_TITLE_MODEL: ChatModel = "google/gemma-4-26b-a4b-it";
export const FILE_DESCRIPTION_MODEL: ChatModel = "google/gemma-4-26b-a4b-it";

export const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";

/**
 * Requested from the model via Matryoshka truncation for Mastra's memory indexes only:
 * Mastra creates them with the ivfflat default, and pgvector caps ANN indexes at 2000
 * dimensions. Our own file index is flat (exact scan) and takes the native 4096.
 */
export const MEMORY_EMBEDDING_DIMENSION = 1536;
