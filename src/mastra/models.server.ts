import type { ObservationalMemoryOptions } from "@mastra/core/memory";
import type { RequestContext } from "@mastra/core/request-context";
import { createOpenRouter, type OpenRouterChatSettings } from "@openrouter/ai-sdk-provider";
import { Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import type { ModelCapability } from "@/lib/model-capability";
import { DEFAULT_MODEL_CAPABILITY } from "@/lib/model-capability";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";

const createOpenrouterProvider = (apiKey: string) =>
  createOpenRouter({
    apiKey,
    appName: "Mnemonic",
  });

type OpenrouterModel = {
  model: string;
  openrouter?: OpenRouterChatSettings;
};

const models: Record<ModelCapability, OpenrouterModel> = {
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
    model: "openai/gpt-5.6-luna-pro",
  },
  max: {
    model: "moonshotai/kimi-k3",
  },
};

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
const OBSERVATIONAL_MEMORY_MODEL = "xiaomi/mimo-v2.5";
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

const providerKeyCtx = Kit.createContext(dbKit);

type ModelResolverInput = {
  requestContext: RequestContext<any>;
};

const resolveCapabilityModel = async (
  input: ModelResolverInput,
  overrideCapability?: (modelCapability: ModelCapability) => ModelCapability,
) => {
  const parsed = v.safeParse(mnemonicRequestContextSchema, input.requestContext.all);

  // `DurableAgent`'s constructor probes `getModel()` with an empty context to describe the agent it
  // wraps; execution always goes through the wrapped agent with a real one. The schema is the
  // single test for which case this is. The probe gets a bare model id — it names the right model
  // without minting a provider that could only ever fail against OpenRouter.
  if (!parsed.success) {
    return models[DEFAULT_MODEL_CAPABILITY].model;
  }

  const { providerKeyId, modelCapability } = parsed.output;

  const config = models[overrideCapability?.(modelCapability) ?? modelCapability];
  const result = await resolveProviderKeyById(providerKeyCtx, providerKeyId);

  if (Result.isError(result)) {
    throw result.error;
  }

  const apiKey = result.value.key;

  return createOpenrouterProvider(apiKey)(config.model, config.openrouter);
};

export const getAgentModel = async (input: ModelResolverInput) => resolveCapabilityModel(input);

const subagentModelCapability = {
  standard: "standard",
  balanced: "standard",
  max: "balanced",
} as const satisfies Record<ModelCapability, ModelCapability>;

export const getSubagentModel = async (input: ModelResolverInput) =>
  resolveCapabilityModel(input, (capability) => subagentModelCapability[capability]);

export const getObservationalMemoryModel = (apiKey: string) =>
  createOpenrouterProvider(apiKey)(OBSERVATIONAL_MEMORY_MODEL);

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
    observeAttachments: false,
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
