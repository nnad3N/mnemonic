import type { ObservationalMemoryOptions } from "@mastra/core/memory";
import type { RequestContext } from "@mastra/core/request-context";
import type { OpenRouterProviderOptions } from "@openrouter/ai-sdk-provider";

import { modelCapabilityLevels } from "@/lib/model-capability";
import type { ModelCapability } from "@/lib/model-capability";
import { openrouter } from "@/mastra/openrouter";
import type { MnemonicRequestContext } from "@/mastra/request-context.ts";

/** Qwen3 Embedding 8B native output size. */
export const FILE_EMBEDDING_DIMENSION = 4096;

export { modelCapabilityLevels };
export type { ModelCapability };

type ModelCapabilityModel = {
  model: string;
  openrouter?: OpenRouterProviderOptions;
};

export const modelCapabilityModels: Record<ModelCapability, ModelCapabilityModel> = {
  standard: {
    model: "xiaomi/mimo-v2.5",
  },
  balanced: {
    model: "openai/gpt-5.6-luna",
    openrouter: {
      reasoning: {
        effort: "xhigh",
      },
    },
  },
  max: {
    model: "moonshotai/kimi-k3",
  },
};

export const models = {
  embedding: openrouter.textEmbeddingModel("qwen/qwen3-embedding-8b"),
  forModelCapability: (capability: ModelCapability) => {
    const config = modelCapabilityModels[capability];
    return openrouter(config.model, config.openrouter);
  },
  observationalMemory: openrouter(modelCapabilityModels.standard.model),
  threadTitle: openrouter("google/gemma-4-26b-a4b-it"),
} as const;

const observationalMemoryReasoningOff = {
  openrouter: {
    reasoning: {
      effort: "none",
    },
  },
} as const;

type ObservationalMemoryRetrieval = NonNullable<ObservationalMemoryOptions["retrieval"]>;

export const observationalMemoryOptions = (
  retrieval: ObservationalMemoryRetrieval,
): ObservationalMemoryOptions => ({
  activateAfterIdle: "auto",
  activateOnProviderChange: true,
  model: models.observationalMemory,
  observation: {
    providerOptions: observationalMemoryReasoningOff,
  },
  reflection: {
    activateAfterIdle: "auto",
    activateOnProviderChange: true,
    providerOptions: observationalMemoryReasoningOff,
  },
  retrieval,
  scope: "thread",
  temporalMarkers: true,
});

type GetAgentModelInput = {
  requestContext: RequestContext<MnemonicRequestContext>;
};

export const getAgentModel = ({ requestContext }: GetAgentModelInput) => {
  const capability = requestContext.get("modelCapability");

  return models.forModelCapability(capability);
};
