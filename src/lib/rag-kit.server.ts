import { embedMany, generateText } from "ai";
import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

import * as Kit from "@/lib/kit";
import { getEmbeddingModel, getFileDescriptionModel } from "@/mastra/config.server";

export class RagError extends TaggedError("RagError")<{
  cause: unknown;
  message: string;
}> {}

type EmbedInput = {
  abortSignal?: AbortSignal;
  apiKey: string;
  values: string[];
};

type DescribeInput = {
  abortSignal?: AbortSignal;
  apiKey: string;
  instructions: string;
  prompt: string;
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
            model: getFileDescriptionModel(input.apiKey),
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
          model: getEmbeddingModel(input.apiKey),
          values: input.values,
        });

        return embeddings;
      },
      catch: (cause) => new RagError({ cause, message: "Failed to embed the document" }),
    }),
});

export type RagKit = typeof ragKit;
