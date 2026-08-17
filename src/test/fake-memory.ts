import { Result } from "better-result";

import { createMemoryKit, type MemoryApi } from "@/lib/memory-kit.server";

const unusedThread = {
  id: "thread-unused",
  resourceId: "resource-unused",
  title: "title",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

/**
 * Every MemoryApi method stubbed with an empty Ok. Override only the ones the test
 * exercises; the rest exist so the object satisfies MemoryApi.
 */
export const createFakeMemory = (overrides: Partial<MemoryApi> = {}) => {
  const api: MemoryApi = {
    clearResourceObservations: async () => Promise.resolve(Result.ok()),
    deleteMessages: async () => Promise.resolve(Result.ok()),
    deleteThread: async () => Promise.resolve(Result.ok()),
    getThreadById: async () => Promise.resolve(Result.ok(null)),
    listMessages: async () =>
      Promise.resolve(
        Result.ok({ messages: [], total: 0, page: 0, perPage: false as const, hasMore: false }),
      ),
    listThreads: async () =>
      Promise.resolve(
        Result.ok({ threads: [], total: 0, page: 0, perPage: false as const, hasMore: false }),
      ),
    saveMessages: async () => Promise.resolve(Result.ok({ messages: [] })),
    saveThread: async () => Promise.resolve(Result.ok(unusedThread)),
    updateMessageMetadata: async () => Promise.resolve(Result.ok()),
    updateThread: async () => Promise.resolve(Result.ok(unusedThread)),
    ...overrides,
  };

  return createMemoryKit(api);
};
