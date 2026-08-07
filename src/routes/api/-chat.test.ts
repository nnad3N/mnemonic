import type { MastraDBMessage } from "@mastra/core/agent/message-list";
import type { StorageListMessagesOutput } from "@mastra/core/storage";
import { Result } from "better-result";
import { describe, expect, it, vi } from "vitest";

import { dbKit } from "@/lib/db-kit";
import { Kit } from "@/lib/kit";
import { createMemoryKit, type MemoryApi } from "@/lib/memory-kit";
import { expectOk } from "@/test/result";

import { persistSealedAssistantOnAbort } from "./chat";

const THREAD_ID = "thread-seal-abort-test";
const AGENT_ID = "conversation-agent" as const;
const COMPLETED_AT = Temporal.Instant.from("2026-01-01T00:00:20.000Z");

const unusedThread = {
  id: THREAD_ID,
  resourceId: "resource",
  title: "title",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createMessage = (input: {
  id: string;
  role: "user" | "assistant";
  parts: MastraDBMessage["content"]["parts"];
}): MastraDBMessage => ({
  id: input.id,
  role: input.role,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  threadId: THREAD_ID,
  content: {
    format: 2,
    parts: input.parts,
  },
});

const createMemoryApi = (input: {
  listMessages: MemoryApi["listMessages"];
  saveMessages?: MemoryApi["saveMessages"];
}): MemoryApi => ({
  deleteAgentThread: async () => Promise.resolve(Result.ok()),
  deleteMessages: async () => Promise.resolve(Result.ok()),
  listThreads: async () =>
    Promise.resolve(
      Result.ok({
        threads: [],
        total: 0,
        page: 0,
        perPage: false as const,
        hasMore: false,
      }),
    ),
  deleteThread: async () => Promise.resolve(Result.ok()),
  getThreadById: async () => Promise.resolve(Result.ok(null)),
  listMessages: input.listMessages,
  saveMessages: input.saveMessages ?? (async () => Promise.resolve(Result.ok({ messages: [] }))),
  saveThread: async () => Promise.resolve(Result.ok(unusedThread)),
  updateThread: async () => Promise.resolve(Result.ok(unusedThread)),
});

const createCtx = (input: {
  messages: MastraDBMessage[];
  saveMessages?: MemoryApi["saveMessages"];
}) =>
  Kit.createContext(
    dbKit,
    createMemoryKit(
      createMemoryApi({
        listMessages: async () =>
          Promise.resolve(
            Result.ok({
              messages: input.messages,
              total: input.messages.length,
              page: 0,
              perPage: false as const,
              hasMore: false,
            } satisfies StorageListMessagesOutput),
          ),
        saveMessages: input.saveMessages,
      }),
    ),
  );

describe("persistSealedAssistantOnAbort", () => {
  it("seals open work segments on the latest assistant message and saves", async () => {
    const startedAt = "2026-01-01T00:00:00.000Z";

    const openAssistant = createMessage({
      id: "assistant-open",
      role: "assistant",
      parts: [
        {
          type: "data-work-start",
          data: { segmentId: "open", startedAt },
        },
      ],
    });

    let saved: MastraDBMessage[] | undefined;

    const result = await persistSealedAssistantOnAbort(
      createCtx({
        messages: [
          createMessage({
            id: "user-1",
            role: "user",
            parts: [{ type: "text", text: "hi" }],
          }),
          createMessage({
            id: "assistant-closed",
            role: "assistant",
            parts: [
              {
                type: "data-work-start",
                data: { segmentId: "older", startedAt },
              },
              {
                type: "data-work-end",
                data: {
                  segmentId: "older",
                  completedAt: "2026-01-01T00:00:05.000Z",
                  durationMs: 5_000,
                },
              },
            ],
          }),
          openAssistant,
        ],
        saveMessages: async ({ messages }) => {
          saved = messages;
          return Promise.resolve(Result.ok({ messages }));
        },
      }),
      { agentId: AGENT_ID, completedAt: COMPLETED_AT, threadId: THREAD_ID },
    );

    expectOk(result);
    expect(saved).toEqual([
      {
        ...openAssistant,
        content: {
          ...openAssistant.content,
          parts: [
            openAssistant.content.parts.at(0),
            {
              type: "data-work-end",
              data: {
                segmentId: "open",
                completedAt: COMPLETED_AT.toString(),
                durationMs: 20_000,
              },
            },
          ],
        },
      },
    ]);
  });

  it("does not save when the latest assistant has no open work segments", async () => {
    const saveMessages = vi.fn<MemoryApi["saveMessages"]>(async () =>
      Promise.resolve(Result.ok({ messages: [] })),
    );

    const result = await persistSealedAssistantOnAbort(
      createCtx({
        messages: [
          createMessage({
            id: "assistant-1",
            role: "assistant",
            parts: [
              {
                type: "data-work-start",
                data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00.000Z" },
              },
              {
                type: "data-work-end",
                data: {
                  segmentId: "seg-1",
                  completedAt: "2026-01-01T00:00:10.000Z",
                  durationMs: 10_000,
                },
              },
            ],
          }),
        ],
        saveMessages,
      }),
      { agentId: AGENT_ID, completedAt: COMPLETED_AT, threadId: THREAD_ID },
    );

    expectOk(result);
    expect(saveMessages).not.toHaveBeenCalled();
  });

  it("does not save when there is no assistant message", async () => {
    const saveMessages = vi.fn<MemoryApi["saveMessages"]>(async () =>
      Promise.resolve(Result.ok({ messages: [] })),
    );

    const result = await persistSealedAssistantOnAbort(
      createCtx({
        messages: [
          createMessage({
            id: "user-1",
            role: "user",
            parts: [{ type: "text", text: "hi" }],
          }),
        ],
        saveMessages,
      }),
      { agentId: AGENT_ID, completedAt: COMPLETED_AT, threadId: THREAD_ID },
    );

    expectOk(result);
    expect(saveMessages).not.toHaveBeenCalled();
  });
});
