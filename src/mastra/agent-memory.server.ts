import type { RequestContext } from "@mastra/core/request-context";
import { Memory } from "@mastra/memory";
import { Result } from "better-result";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import {
  getModel,
  getEmbeddingModel,
  observationalMemoryOptions,
} from "@/mastra/config.server";
import { OBSERVATIONAL_MEMORY_MODEL } from "@/mastra/models.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { mastraStore, mastraVector } from "@/mastra/storage.server";

type ObservationalMemoryRetrievalScope = "thread" | "resource";

type CreateAgentMemoryInput = {
  requestContext: RequestContext<MnemonicRequestContext>;
};

const providerKeyCtx = Kit.createContext(dbKit);

export const getAgentMemory =
  (retrievalScope: ObservationalMemoryRetrievalScope) =>
  async ({ requestContext }: CreateAgentMemoryInput): Promise<Memory> => {
    const result = await resolveProviderKeyById(
      providerKeyCtx,
      requestContext.get("providerKeyId"),
    );

    if (Result.isError(result)) {
      throw result.error;
    }

    return new Memory({
      embedder: getEmbeddingModel(result.value),
      options: {
        observationalMemory: observationalMemoryOptions(
          { scope: retrievalScope, vector: true },
          getModel(result.value)(OBSERVATIONAL_MEMORY_MODEL),
        ),
      },
      storage: mastraStore,
      vector: mastraVector,
    });
  };
