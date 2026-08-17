import type { MastraDBMessage } from "@mastra/core/agent/message-list";
import type { MastraMemory } from "@mastra/core/memory";
import type {
  MemoryStorage,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
} from "@mastra/core/storage";
import { Memory } from "@mastra/memory";
import type { Result as ResultType } from "better-result";
import { panic, Result, TaggedError } from "better-result";

import { drizzleDb } from "@/db/client.server";
import { mastraThread } from "@/db/mastra-schema.server";
import { startsWith } from "@/db/sql.server";
import * as Kit from "@/lib/kit";
import { libsqlStore, libsqlVector } from "@/mastra/storage.server";

type GetThreadInput = Parameters<MemoryStorage["getThreadById"]>[0];
type GetThreadOutput = Awaited<ReturnType<MemoryStorage["getThreadById"]>>;
type SaveMessagesOutput = Awaited<ReturnType<MastraMemory["saveMessages"]>>;
type SaveThreadInput = Parameters<MemoryStorage["saveThread"]>[0];
type SaveThreadOutput = Awaited<ReturnType<MemoryStorage["saveThread"]>>;
type UpdateThreadInput = Parameters<MemoryStorage["updateThread"]>[0];
type UpdateThreadOutput = Awaited<ReturnType<MemoryStorage["updateThread"]>>;

export class MemoryError extends TaggedError("MemoryError")<{
  cause: unknown;
  message: string;
}> {}

const toMemoryError = (cause: unknown): MemoryError =>
  new MemoryError({
    cause,
    message: "Memory operation failed",
  });

export type MemoryApi = {
  clearResourceObservations: (input: {
    resourceId: string;
  }) => Promise<ResultType<void, MemoryError>>;
  deleteMessages: (input: { messageIds: string[] }) => Promise<ResultType<void, MemoryError>>;
  listThreads: (
    input: StorageListThreadsInput,
  ) => Promise<ResultType<StorageListThreadsOutput, MemoryError>>;
  deleteThread: (input: { threadId: string }) => Promise<ResultType<void, MemoryError>>;
  getThreadById: (input: GetThreadInput) => Promise<ResultType<GetThreadOutput, MemoryError>>;
  listMessages: (
    input: StorageListMessagesInput,
  ) => Promise<ResultType<StorageListMessagesOutput, MemoryError>>;
  saveMessages: (input: {
    messages: MastraDBMessage[];
  }) => Promise<ResultType<SaveMessagesOutput, MemoryError>>;
  saveThread: (input: SaveThreadInput) => Promise<ResultType<SaveThreadOutput, MemoryError>>;
  updateMessageMetadata: (input: {
    id: string;
    metadata: Record<string, unknown>;
  }) => Promise<ResultType<void, MemoryError>>;
  updateThread: (input: UpdateThreadInput) => Promise<ResultType<UpdateThreadOutput, MemoryError>>;
};

export const createMemoryKit = (api: MemoryApi) => Kit.define("memory", api);

/**
 * Memory over the shared store and vector, without an embedder or observational-memory
 * model. Agent memories are resolved per user because they carry that user's API key;
 * none of these operations reach a model, so they must keep working without one.
 *
 * Prefer this over the raw store: only `Memory` cascades a delete into observational memory
 * and thread vectors, and only its save runs messages through `MessageList` normalization.
 */
const memory = new Memory({ storage: libsqlStore, vector: libsqlVector });

const getMemoryStore = async (): Promise<MemoryStorage> => {
  const memoryStore = await libsqlStore.getStore("memory");

  if (!memoryStore) {
    panic("Mastra memory storage is not configured");
  }

  return memoryStore;
};

/**
 * Observational memory embeds observations into `memory_observations_<dimension>`, but
 * Mastra's thread delete only sweeps indexes prefixed `memory_messages`, so those vectors
 * outlive the thread they came from. The dimension is part of the index name, so match the
 * prefix rather than pinning the embedder's current output size.
 */
const deleteObservationVectors = async (
  filter: { resource_id: string } | { thread_id: string },
) => {
  const indexNames = await libsqlVector.listIndexes();

  await Promise.all(
    indexNames
      .filter((name) => name.startsWith("memory_observations"))
      .map(async (indexName) => libsqlVector.deleteVectors({ filter, indexName })),
  );
};

/**
 * Mastra names a subagent thread `${parentThreadId}-${uuid}` and writes nothing that links
 * it back to its parent, so descendants are only discoverable by id prefix. A nested
 * delegation appends another suffix, so one prefix match covers every depth, and a thread
 * that delegated to nobody matches nothing.
 */
const listThreadTreeIds = async (threadId: string): Promise<string[]> => {
  const descendants = await drizzleDb
    .select({ id: mastraThread.id })
    .from(mastraThread)
    .where(startsWith(mastraThread.id, `${threadId}-`));

  return [...descendants.map((thread) => thread.id), threadId];
};

export const memoryKit = createMemoryKit({
  // Thread deletion only ever clears thread-scoped observations; a resource-scoped
  // observation outlives every thread under it and has to be cleared by its owner.
  clearResourceObservations: async ({ resourceId }) =>
    Result.tryPromise({
      try: async () => {
        const memoryStore = await getMemoryStore();
        await memoryStore.clearObservationalMemory(null, resourceId);
        await deleteObservationVectors({ resource_id: resourceId });
      },
      catch: toMemoryError,
    }),
  deleteMessages: async ({ messageIds }) =>
    Result.tryPromise({
      try: async () => memory.deleteMessages(messageIds),
      catch: toMemoryError,
    }),
  listThreads: async (input) =>
    Result.tryPromise({
      try: async () => memory.listThreads(input),
      catch: toMemoryError,
    }),
  deleteThread: async ({ threadId }) =>
    Result.tryPromise({
      try: async () => {
        const ids = await listThreadTreeIds(threadId);

        await Promise.all(
          ids.map(async (id) => {
            await memory.deleteThread(id);
            await deleteObservationVectors({ thread_id: id });
          }),
        );
      },
      catch: toMemoryError,
    }),
  getThreadById: async (input) =>
    Result.tryPromise({
      try: async () => memory.getThreadById(input),
      catch: toMemoryError,
    }),
  listMessages: async (input) =>
    Result.tryPromise({
      try: async () => {
        const memoryStore = await getMemoryStore();
        return memoryStore.listMessages(input);
      },
      catch: toMemoryError,
    }),
  saveMessages: async ({ messages }) =>
    Result.tryPromise({
      try: async () => memory.saveMessages({ messages }),
      catch: toMemoryError,
    }),
  saveThread: async (input) =>
    Result.tryPromise({
      try: async () => memory.saveThread(input),
      catch: toMemoryError,
    }),
  updateMessageMetadata: async ({ id, metadata }) =>
    Result.tryPromise({
      try: async () => {
        const memoryStore = await getMemoryStore();
        const { messages } = await memoryStore.listMessagesById({ messageIds: [id] });
        const message = messages.at(0);

        if (!message) {
          return;
        }

        await memoryStore.updateMessages({
          messages: [
            {
              id,
              content: {
                ...message.content,
                metadata: { ...message.content.metadata, ...metadata },
              },
            },
          ],
        });
      },
      catch: toMemoryError,
    }),
  updateThread: async (input) =>
    Result.tryPromise({
      try: async () => memory.updateThread(input),
      catch: toMemoryError,
    }),
});

export type MemoryKit = typeof memoryKit;
