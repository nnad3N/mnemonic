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

type ModelInputs = {
  acceptsPdf: boolean;
};

const modelInputs = {
  "google/gemini-3.8-flash": { acceptsPdf: true },
  "google/gemma-4-26b-a4b-it": { acceptsPdf: false },
  "moonshotai/kimi-k3": { acceptsPdf: false },
  "z-ai/glm-5.3-flash": { acceptsPdf: false },
} satisfies Record<string, ModelInputs>;

export type ChatModel = keyof typeof modelInputs;

export const modelAcceptsPdf = (model: ChatModel) => modelInputs[model].acceptsPdf;

type AgentModel = {
  model: ChatModel;
  openrouter?: OpenRouterChatSettings;
};

// oxlint-disable-next-line anti-slop/no-known-value-widening
const models: Record<ModelOption, AgentModel> = {
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

const SUBAGENT_MODEL: ChatModel = "z-ai/glm-5.3-flash";

export const getAgentModel = (agentId: ModelAgentId, modelOption: ModelOption): AgentModel => {
  switch (agentId) {
    case CONVERSATION_AGENT_ID:
    case TOPIC_AGENT_ID:
      return models[modelOption];
    case READER_AGENT_ID:
    case WORKER_AGENT_ID:
      return { model: SUBAGENT_MODEL };
  }
};
export const OBSERVATIONAL_MEMORY_MODEL: ChatModel = "z-ai/glm-5.3-flash";
export const THREAD_TITLE_MODEL: ChatModel = "google/gemma-4-26b-a4b-it";
export const FILE_DESCRIPTION_MODEL: ChatModel = "google/gemma-4-26b-a4b-it";

export const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";

// Matryoshka truncation from the native 4096: pgvector caps ANN indexes at 2000 dimensions,
export const EMBEDDING_DIMENSION = 1024;
