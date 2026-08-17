import type { RequestContext } from "@mastra/core/request-context";
import { Memory } from "@mastra/memory";
import { Result } from "better-result";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import {
  getEmbeddingModel,
  getObservationalMemoryModel,
  observationalMemoryOptions,
} from "@/mastra/models.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { libsqlStore, libsqlVector } from "@/mastra/storage.server";

type ObservationalMemoryScope = "thread" | "resource";

type CreateAgentMemoryInput = {
  requestContext: RequestContext<MnemonicRequestContext>;
};

const providerKeyCtx = Kit.createContext(dbKit);

export const getAgentMemory =
  (scope: ObservationalMemoryScope) =>
  async ({ requestContext }: CreateAgentMemoryInput): Promise<Memory> => {
    const result = await resolveProviderKeyById(
      providerKeyCtx,
      requestContext.get("providerKeyId"),
    );

    if (Result.isError(result)) {
      throw result.error;
    }

    const apiKey = result.value.key;

    return new Memory({
      embedder: getEmbeddingModel(apiKey),
      options: {
        observationalMemory: observationalMemoryOptions(
          { scope, vector: true },
          getObservationalMemoryModel(apiKey),
        ),
      },
      storage: libsqlStore,
      vector: libsqlVector,
    });
  };
