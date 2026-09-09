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
  READER_AGENT_ID,
  WORKER_AGENT_ID,
]);

export type ModelAgentId = Kit.LiteralMember<typeof ModelAgentIds>;

type AgentModel = {
  model: string;
  inputs: {
    pdf: boolean;
    images: boolean;
  };
  openrouter?: OpenRouterChatSettings;
};

const models = {
  research: {
    model: "z-ai/glm-5.3-flash",
    inputs: { pdf: false, images: true },
  },
  analysis: {
    model: "deepseek/deepseek-v4-flash-vision-exp",
    inputs: { pdf: false, images: true },
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
  knowledge: {
    model: "deepseek/deepseek-v4-pro-0813",
    inputs: { pdf: false, images: false },
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
} as const satisfies Record<ModelOption, AgentModel>;

export const getAgentModel = (agentId: ModelAgentId, modelOption: ModelOption): AgentModel => {
  switch (agentId) {
    case CONVERSATION_AGENT_ID:
    case TOPIC_AGENT_ID:
      return models[modelOption];
    case READER_AGENT_ID:
    case WORKER_AGENT_ID:
      return {
        model: "z-ai/glm-5.3-flash",
        inputs: { pdf: false, images: true },
      };
  }
};

export const OBSERVATIONAL_MEMORY_MODEL = "z-ai/glm-5.3-flash";
export const THREAD_TITLE_MODEL = "google/gemma-4-26b-a4b-it";
export const FILE_DESCRIPTION_MODEL = "google/gemma-4-26b-a4b-it";

export const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";

// Matryoshka truncation from the native 4096: pgvector caps ANN indexes at 2000 dimensions,
export const EMBEDDING_DIMENSION = 1024;
