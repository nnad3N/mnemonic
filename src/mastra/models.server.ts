import type { ObservationalMemoryOptions } from "@mastra/core/memory";
import type { RequestContext } from "@mastra/core/request-context";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import { DEFAULT_MODEL_CAPABILITY } from "@/lib/model-capability";
import type { ChatModel, ModelAgentId } from "@/mastra/agent-models.server";
import { getAgentModelConfig } from "@/mastra/agent-models.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";

const createOpenrouterProvider = (apiKey: string) =>
  createOpenRouter({
    apiKey,
    appName: "Mnemonic",
  });

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
const OBSERVATIONAL_MEMORY_MODEL: ChatModel = "xiaomi/mimo-v2.5";
const THREAD_TITLE_MODEL: ChatModel = "google/gemma-4-26b-a4b-it";

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

/**
 * `DurableAgent`'s constructor probes `getModel()` with an empty context to describe the agent it
 * wraps; execution always goes through the wrapped agent with a real one. The schema is the single
 * test for which case this is, and the probe gets no provider: naming a bare model id beats minting
 * one that could only ever fail against OpenRouter.
 */
const getRequestProvider = async (input: ModelResolverInput) => {
  const parsed = v.safeParse(mnemonicRequestContextSchema, input.requestContext.all);

  if (!parsed.success) {
    return;
  }

  const result = await resolveProviderKeyById(providerKeyCtx, parsed.output.providerKeyId);

  if (Result.isError(result)) {
    throw result.error;
  }

  return {
    modelCapability: parsed.output.modelCapability,
    openrouter: createOpenrouterProvider(result.value.key),
  };
};

export const getAgentModel = (agentId: ModelAgentId) => async (input: ModelResolverInput) => {
  const resolved = await getRequestProvider(input);

  if (!resolved) {
    return getAgentModelConfig(agentId, DEFAULT_MODEL_CAPABILITY).model;
  }

  const config = getAgentModelConfig(agentId, resolved.modelCapability);

  return resolved.openrouter(config.model, config.openrouter);
};

export const getStaticModel = (model: ChatModel) => async (input: ModelResolverInput) => {
  const resolved = await getRequestProvider(input);

  return resolved?.openrouter(model) ?? model;
};

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
