import type { ObservationalMemoryOptions } from "@mastra/core/memory";
import type { RequestContext } from "@mastra/core/request-context";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import type { ProviderKey } from "@/lib/middleware/resolve-provider-key.server";
import { DEFAULT_MODEL_OPTION } from "@/lib/model-option";
import type { ModelAgentId } from "@/mastra/models.server";
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL, getAgentModel } from "@/mastra/models.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";

export const getModel = (providerKey: ProviderKey) => {
  switch (providerKey.provider) {
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    case "openrouter":
      return createOpenRouter({ apiKey: providerKey.key, appName: "Mnemonic" });
  }
};

const EMBEDDING_BATCH_SIZE = 96;

/**
 * Mastra only accepts embedding models tagged `v2` or `v3`, while the AI SDK v7 OpenRouter
 * provider emits `v4`. The interfaces are otherwise identical except for the `deprecated`
 * warning variant, which `v3` cannot represent. Drop this once Mastra supports v4 embedders.
 */
export const getEmbeddingModel = (providerKey: ProviderKey) => {
  const openrouterEmbedding = getModel(providerKey).textEmbeddingModel(EMBEDDING_MODEL, {
    extraBody: { dimensions: EMBEDDING_DIMENSION },
  });

  return {
    doEmbed: async (options: Parameters<typeof openrouterEmbedding.doEmbed>[0]) => {
      const { embeddings, usage, warnings } = await openrouterEmbedding.doEmbed(options);
      return {
        embeddings,
        usage,
        warnings: warnings.filter((warning) => warning.type !== "deprecated"),
      };
    },
    // OpenRouter reports no batch limit, which makes the AI SDK embed a whole document in one request.
    maxEmbeddingsPerCall: EMBEDDING_BATCH_SIZE,
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

  return { modelOption: parsed.output.modelOption, providerKey: result.value };
};

export const resolveAgentModel = (agentId: ModelAgentId) => async (input: ModelResolverInput) => {
  const resolved = await getRequestProvider(input);
  const config = getAgentModel(agentId, resolved?.modelOption ?? DEFAULT_MODEL_OPTION);

  if (!resolved) {
    return config.model;
  }

  return getModel(resolved.providerKey)(config.model, config.openrouter);
};

type ObservationalMemoryRetrieval = NonNullable<ObservationalMemoryOptions["retrieval"]>;

export const observationalMemoryOptions = (
  retrieval: ObservationalMemoryRetrieval,
  model: ObservationalMemoryOptions["model"],
): ObservationalMemoryOptions => ({
  activateAfterIdle: "auto",
  activateOnProviderChange: true,
  model,
  observation: {
    bufferTokens: 0.5,
    messageTokens: 60_000,
    observeAttachments: false,
  },
  reflection: {
    activateAfterIdle: "auto",
    activateOnProviderChange: true,
  },
  retrieval,
  scope: "thread",
  temporalMarkers: true,
});
