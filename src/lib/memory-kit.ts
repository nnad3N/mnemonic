import type { MemoryStorage } from "@mastra/core/storage";
import { Result, TaggedError } from "better-result";

import { Kit } from "@/lib/kit";
import { getMemoryStore } from "@/mastra/memory";

export class MemoryError extends TaggedError("MemoryError")<{
  cause: unknown;
  message: string;
}>() {}

const toMemoryError = (cause: unknown): MemoryError =>
  new MemoryError({
    cause,
    message: cause instanceof Error ? cause.message : "Memory operation failed",
  });

export const memoryKit = Kit.define(
  "memory",
  async <TValue>(operation: (memory: MemoryStorage) => Promise<TValue>) =>
    Result.tryPromise({
      try: async () => operation(await getMemoryStore()),
      catch: toMemoryError,
    })
);

export type MemoryKit = typeof memoryKit;
