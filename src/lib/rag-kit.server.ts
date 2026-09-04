import { embedMany, generateText } from "ai";
import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

import * as Kit from "@/lib/kit";
import type { ProviderKey } from "@/lib/middleware/resolve-provider-key.server";
import { getModel, getEmbeddingModel } from "@/mastra/config.server";
import { FILE_DESCRIPTION_MODEL } from "@/mastra/models.server";

export class RagError extends TaggedError("RagError")<{
  cause: unknown;
  message: string;
}> {}

type EmbedInput = {
  abortSignal?: AbortSignal;
  providerKey: ProviderKey;
  values: string[];
};

type DescribeInput = {
  abortSignal?: AbortSignal;
  instructions: string;
  prompt: string;
  providerKey: ProviderKey;
};

export type RagApi = {
  describe: (input: DescribeInput) => Promise<ResultType<string, RagError>>;
  embed: (input: EmbedInput) => Promise<ResultType<number[][], RagError>>;
};

export const createRagKit = (api: RagApi) => Kit.define("rag", api);

export const ragKit = createRagKit({
  describe: async (input) =>
    Result.tryPromise(
      {
        try: async ({ signal }) => {
          const result = await generateText({
            abortSignal: signal,
            instructions: input.instructions,
            model: getModel(input.providerKey)(FILE_DESCRIPTION_MODEL),
            prompt: input.prompt,
          });

          return result.text;
        },
        catch: (cause) => new RagError({ cause, message: "Failed to describe the document" }),
      },
      {
        retry: { times: 3, delayMs: 500, backoff: "exponential" },
        signal: input.abortSignal,
      },
    ),
  embed: async (input) =>
    Result.tryPromise({
      try: async () => {
        const { embeddings } = await embedMany({
          abortSignal: input.abortSignal,
          model: getEmbeddingModel(input.providerKey),
          values: input.values,
        });

        return embeddings;
      },
      catch: (cause) => new RagError({ cause, message: "Failed to embed the document" }),
    }),
});

export type RagKit = typeof ragKit;
