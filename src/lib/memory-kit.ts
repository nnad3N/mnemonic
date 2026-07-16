import type {
  StorageListThreadsInput,
  StorageListThreadsOutput,
} from "@mastra/core/storage";
import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

import { Kit } from "@/lib/kit";
import { getMemoryStore } from "@/mastra/memory";

export class MemoryError extends TaggedError("MemoryError")<{
  cause: unknown;
  message: string;
}>() {}

const toMemoryError = (cause: unknown): MemoryError =>
  new MemoryError({
    cause,
    message: "Memory operation failed",
  });

export type MemoryApi = {
  listThreads: (
    input: StorageListThreadsInput
  ) => Promise<ResultType<StorageListThreadsOutput, MemoryError>>;
  deleteThread: (input: {
    threadId: string;
  }) => Promise<ResultType<void, MemoryError>>;
};

export const createMemoryKit = (api: MemoryApi) => Kit.define("memory", api);

export const memoryKit = createMemoryKit({
  listThreads: async (input) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getMemoryStore();
        return memory.listThreads(input);
      },
      catch: toMemoryError,
    }),
  deleteThread: async (input) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getMemoryStore();
        return memory.deleteThread(input);
      },
      catch: toMemoryError,
    }),
});

export type MemoryKit = typeof memoryKit;
