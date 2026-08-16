import type { ObservationalMemoryOptions } from "@mastra/core/memory";
import type { RequestContext } from "@mastra/core/request-context";
import { createOpenRouter, type OpenRouterProviderOptions } from "@openrouter/ai-sdk-provider";

import type { ModelCapability } from "@/lib/model-capability";
import type { MnemonicRequestContext } from "@/mastra/request-context";

/** Qwen3 Embedding 8B native output size. */
export const FILE_EMBEDDING_DIMENSION = 4096;

const createOpenrouterProvider = (apiKey: string) =>
  createOpenRouter({
    apiKey,
    appName: "Mnemonic",
  });

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

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
const THREAD_TITLE_MODEL = "google/gemma-4-26b-a4b-it";

/**
 * Mastra only accepts embedding models tagged `v2` or `v3`, while the AI SDK v7 OpenRouter
 * provider emits `v4`. The interfaces are otherwise identical except for the `deprecated`
 * warning variant, which `v3` cannot represent. Drop this once Mastra supports v4 embedders.
 */
export const getEmbeddingModel = (apiKey: string) => {
  const openrouterEmbedding = createOpenrouterProvider(apiKey).textEmbeddingModel(EMBEDDING_MODEL);

  return {
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
};

export const getAgentModel = ({
  requestContext,
}: {
  requestContext: RequestContext<MnemonicRequestContext>;
}) => {
  const config = modelCapabilityModels[requestContext.get("modelCapability")];

  return createOpenrouterProvider(requestContext.get("apiKey"))(config.model, config.openrouter);
};

const subagentModelCapability = {
  standard: "standard",
  balanced: "standard",
  max: "balanced",
} as const satisfies Record<ModelCapability, ModelCapability>;

export const getSubagentModel = ({
  requestContext,
}: {
  requestContext: RequestContext<MnemonicRequestContext>;
}) => {
  const config =
    modelCapabilityModels[subagentModelCapability[requestContext.get("modelCapability")]];

  return createOpenrouterProvider(requestContext.get("apiKey"))(config.model, config.openrouter);
};

export const getObservationalMemoryModel = (apiKey: string) =>
  createOpenrouterProvider(apiKey)(modelCapabilityModels.standard.model);

export const getThreadTitleModel = (apiKey: string) =>
  createOpenrouterProvider(apiKey)(THREAD_TITLE_MODEL);

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
  model: ObservationalMemoryOptions["model"],
): ObservationalMemoryOptions => ({
  activateAfterIdle: "auto",
  activateOnProviderChange: true,
  model,
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
