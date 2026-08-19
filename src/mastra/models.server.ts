import type { OpenRouterChatSettings } from "@openrouter/ai-sdk-provider";

import * as Kit from "@/lib/kit";
import type { ModelCapability } from "@/lib/model-capability";

export const CONVERSATION_AGENT_ID = "conversation-agent";
export const TOPIC_AGENT_ID = "topic-agent";
export const READER_AGENT_ID = "reader-agent";
export const WORKER_AGENT_ID = "worker-agent";

/** Agents whose model follows the user's capability choice. The reader pins its own. */
export const ModelAgentIds = Kit.literals.from()([
  CONVERSATION_AGENT_ID,
  TOPIC_AGENT_ID,
  WORKER_AGENT_ID,
]);

export type ModelAgentId = Kit.LiteralMember<typeof ModelAgentIds>;

type ModelInputs = {
  /** OpenRouter routes a PDF part through its file-parser plugin unless the model takes files. */
  acceptsPdf: boolean;
};

/** Every chat model Mnemonic calls, by OpenRouter id. */
const modelInputs = {
  "google/gemini-3.7-flash": { acceptsPdf: true },
  "google/gemma-4-26b-a4b-it": { acceptsPdf: false },
  "moonshotai/kimi-k3": { acceptsPdf: false },
  "openai/gpt-5.6-luna": { acceptsPdf: true },
  "xiaomi/mimo-v2.5": { acceptsPdf: false },
} satisfies Record<string, ModelInputs>;

export type ChatModel = keyof typeof modelInputs;

export const modelAcceptsPdf = (model: ChatModel) => modelInputs[model].acceptsPdf;

type AgentModel = {
  model: ChatModel;
  openrouter?: OpenRouterChatSettings;
};

const models: Record<ModelCapability, AgentModel> = {
  standard: {
    model: "openai/gpt-5.6-luna",
    openrouter: {
      extraBody: {
        verbosity: "low",
      },
      reasoning: {
        effort: "high",
      },
    },
  },
  balanced: {
    model: "google/gemini-3.7-flash",
    openrouter: {
      reasoning: {
        effort: "high",
      },
    },
  },
  max: {
    model: "moonshotai/kimi-k3",
  },
};

/** Subagents run a tier below their parent. */
const agentCapability: Record<ModelAgentId, Record<ModelCapability, ModelCapability>> = {
  [CONVERSATION_AGENT_ID]: { standard: "standard", balanced: "balanced", max: "max" },
  [TOPIC_AGENT_ID]: { standard: "standard", balanced: "balanced", max: "max" },
  [WORKER_AGENT_ID]: { standard: "standard", balanced: "standard", max: "balanced" },
};

export const getAgentModelConfig = (agentId: ModelAgentId, capability: ModelCapability) =>
  models[agentCapability[agentId][capability]];
