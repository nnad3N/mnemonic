import type { MastraDBMessage } from "@mastra/core/agent/message-list";
import type { StorageListMessagesOutput } from "@mastra/core/storage";
import { Result } from "better-result";
import { describe, expect, it, vi } from "vitest";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import type { MemoryApi } from "@/lib/memory-kit.server";
import { createFakeMemory } from "@/test/fake-memory";
import { expectOk } from "@/test/result";

import { persistStreamResult } from "./chat";

const THREAD_ID = "thread-seal-abort-test";
const COMPLETED_AT = Temporal.Instant.from("2026-01-01T00:00:20.000Z");

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

const createCtx = (input: {
  messages: MastraDBMessage[];
  saveMessages?: MemoryApi["saveMessages"];
}) =>
  Kit.createContext(
    dbKit,
    createFakeMemory({
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
      ...(input.saveMessages === undefined ? {} : { saveMessages: input.saveMessages }),
    }),
  );

describe("persistSealedAssistantOnEnd", () => {
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

    const result = await persistStreamResult(
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
      { completedAt: COMPLETED_AT, threadId: THREAD_ID },
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

    const result = await persistStreamResult(
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
      { completedAt: COMPLETED_AT, threadId: THREAD_ID },
    );

    expectOk(result);
    expect(saveMessages).not.toHaveBeenCalled();
  });

  it("does not save when there is no assistant message", async () => {
    const saveMessages = vi.fn<MemoryApi["saveMessages"]>(async () =>
      Promise.resolve(Result.ok({ messages: [] })),
    );

    const result = await persistStreamResult(
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
      { completedAt: COMPLETED_AT, threadId: THREAD_ID },
    );

    expectOk(result);
    expect(saveMessages).not.toHaveBeenCalled();
  });
});
