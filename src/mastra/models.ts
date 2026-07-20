import type { RequestContext } from "@mastra/core/request-context";

import { modelCapabilityLevels } from "@/lib/model-capability";
import type { ModelCapability } from "@/lib/model-capability";
import { openrouter } from "@/mastra/openrouter";
import type { MnemonicRequestContext } from "@/mastra/request-context.ts";

/** Qwen3 Embedding 8B native output size. */
export const FILE_EMBEDDING_DIMENSION = 4096;

export { modelCapabilityLevels };
export type { ModelCapability };

export const modelCapabilityModels = {
  standard: "xiaomi/mimo-v2.5",
  balanced: "minimax/minimax-m3",
  max: "moonshotai/kimi-k3",
} as const satisfies Record<ModelCapability, string>;

export const models = {
  embedding: openrouter.textEmbeddingModel("qwen/qwen3-embedding-8b"),
  forModelCapability: (capability: ModelCapability) =>
    openrouter(modelCapabilityModels[capability]),
  observationalMemory: openrouter(modelCapabilityModels.standard),
  threadTitle: openrouter("google/gemma-4-26b-a4b-it"),
} as const;

type GetAgentModelInput = {
  requestContext: RequestContext<MnemonicRequestContext>;
};

export const getAgentModel = ({ requestContext }: GetAgentModelInput) => {
  const capability = requestContext.get("modelCapability");

  return models.forModelCapability(capability);
};
