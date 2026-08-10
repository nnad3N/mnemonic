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

const openrouterEmbedding = openrouter.textEmbeddingModel("qwen/qwen3-embedding-8b");

/**
 * Mastra only accepts embedding models tagged `v2` or `v3`, while the AI SDK v7 OpenRouter
 * provider emits `v4`. The interfaces are otherwise identical except for the `deprecated`
 * warning variant, which `v3` cannot represent. Drop this once Mastra supports v4 embedders.
 */
const mastraEmbedding = {
  doEmbed: async (options: Parameters<typeof openrouterEmbedding.doEmbed>[0]) => {
    const { embeddings, usage, warnings } = await openrouterEmbedding.doEmbed(options);
    return {
      embeddings,
      usage,
      warnings: warnings.filter((warning) => warning.type !== "deprecated"),
    };
  },
  maxEmbeddingsPerCall: openrouterEmbedding.maxEmbeddingsPerCall,
  modelId: openrouterEmbedding.modelId,
  provider: openrouterEmbedding.provider,
  specificationVersion: "v3" as const,
  supportsParallelCalls: openrouterEmbedding.supportsParallelCalls,
};

export const models = {
  embedding: mastraEmbedding,
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
