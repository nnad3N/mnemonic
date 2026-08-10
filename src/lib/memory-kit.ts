import type { MastraDBMessage } from "@mastra/core/agent/message-list";
import type { MastraMemory } from "@mastra/core/memory";
import type { MemoryStorage } from "@mastra/core/storage";
import type {
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
} from "@mastra/core/storage";
import { panic, Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

import * as Kit from "@/lib/kit";
import { mastra } from "@/mastra";
import type { MnemonicAgentId } from "@/mastra/agents/id";

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
  deleteAgentThread: (input: {
    agentId: MnemonicAgentId;
    threadId: string;
  }) => Promise<ResultType<void, MemoryError>>;
  deleteMessages: (input: {
    agentId: MnemonicAgentId;
    messageIds: string[];
  }) => Promise<ResultType<void, MemoryError>>;
  listThreads: (
    input: StorageListThreadsInput,
  ) => Promise<ResultType<StorageListThreadsOutput, MemoryError>>;
  deleteThread: (input: { threadId: string }) => Promise<ResultType<void, MemoryError>>;
  getThreadById: (input: GetThreadInput) => Promise<ResultType<GetThreadOutput, MemoryError>>;
  listMessages: (
    input: StorageListMessagesInput,
  ) => Promise<ResultType<StorageListMessagesOutput, MemoryError>>;
  saveMessages: (input: {
    agentId: MnemonicAgentId;
    messages: MastraDBMessage[];
  }) => Promise<ResultType<SaveMessagesOutput, MemoryError>>;
  saveThread: (input: SaveThreadInput) => Promise<ResultType<SaveThreadOutput, MemoryError>>;
  updateThread: (input: UpdateThreadInput) => Promise<ResultType<UpdateThreadOutput, MemoryError>>;
};

export const createMemoryKit = (api: MemoryApi) => Kit.define("memory", api);

const getMemoryStore = async (): Promise<MemoryStorage> => {
  const memoryStore = await mastra.getStorage()?.getStore("memory");

  if (!memoryStore) {
    panic("Mastra memory storage is not configured");
  }

  return memoryStore;
};

const getAgentMemory = async (agentId: MnemonicAgentId): Promise<MastraMemory> => {
  const agent = mastra.getAgentById(agentId);
  const memory = await agent.getMemory();

  if (!memory) {
    panic("Agent memory is not configured");
  }

  return memory;
};

export const memoryKit = createMemoryKit({
  deleteAgentThread: async ({ agentId, threadId }) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getAgentMemory(agentId);
        return memory.deleteThread(threadId);
      },
      catch: toMemoryError,
    }),
  deleteMessages: async ({ agentId, messageIds }) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getAgentMemory(agentId);
        return memory.deleteMessages(messageIds);
      },
      catch: toMemoryError,
    }),
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
  getThreadById: async (input) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getMemoryStore();
        return memory.getThreadById(input);
      },
      catch: toMemoryError,
    }),
  listMessages: async (input) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getMemoryStore();
        return memory.listMessages(input);
      },
      catch: toMemoryError,
    }),
  saveMessages: async ({ agentId, messages }) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getAgentMemory(agentId);
        return memory.saveMessages({ messages });
      },
      catch: toMemoryError,
    }),
  saveThread: async (input) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getMemoryStore();
        return memory.saveThread(input);
      },
      catch: toMemoryError,
    }),
  updateThread: async (input) =>
    Result.tryPromise({
      try: async () => {
        const memory = await getMemoryStore();
        return memory.updateThread(input);
      },
      catch: toMemoryError,
    }),
});

export type MemoryKit = typeof memoryKit;
