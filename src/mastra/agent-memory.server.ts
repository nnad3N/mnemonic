import type { RequestContext } from "@mastra/core/request-context";
import { Memory } from "@mastra/memory";

import {
  getEmbeddingModel,
  getObservationalMemoryModel,
  observationalMemoryOptions,
} from "@/mastra/models";
import type { MnemonicRequestContext } from "@/mastra/request-context";
import { libsqlStore, libsqlVector } from "@/mastra/storage";

type ObservationalMemoryScope = "thread" | "resource";

type CreateAgentMemoryInput = {
  requestContext: RequestContext<MnemonicRequestContext>;
};

export const getAgentMemory =
  (scope: ObservationalMemoryScope) =>
  ({ requestContext }: CreateAgentMemoryInput): Memory => {
    const apiKey = requestContext.get("apiKey");

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
