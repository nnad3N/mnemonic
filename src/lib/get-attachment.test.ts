import type { MastraDBMessage } from "@mastra/core/agent/message-list";
import type { StorageListMessagesOutput } from "@mastra/core/storage";
import { Result } from "better-result";
import { describe, expect, it } from "vitest";

import { GetAttachmentError, getAttachment } from "@/lib/get-attachment";
import { hashBytes } from "@/lib/hash";
import * as Kit from "@/lib/kit";
import { createMemoryKit, type MemoryApi } from "@/lib/memory-kit";
import { expectErr, expectOk } from "@/test/result";

const THREAD_ID = "thread-attachment-test";

const unusedThread = {
  id: THREAD_ID,
  resourceId: "resource",
  title: "title",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createUserMessage = (input: {
  attachments?: Array<{ filename: string; mediaType: string; sha256: string }>;
  parts: MastraDBMessage["content"]["parts"];
}): MastraDBMessage => ({
  id: "message-1",
  role: "user",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  threadId: THREAD_ID,
  content: {
    format: 2,
    parts: input.parts,
    ...(input.attachments === undefined
      ? {}
      : {
          metadata: {
            attachments: input.attachments,
          },
        }),
  },
});

const createMemoryApi = (listMessages: MemoryApi["listMessages"]): MemoryApi => ({
  clearResourceObservations: async () => Promise.resolve(Result.ok(undefined)),
  deleteMessages: async () => Promise.resolve(Result.ok(undefined)),
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
  deleteThread: async () => Promise.resolve(Result.ok(undefined)),
  getThreadById: async () => Promise.resolve(Result.ok(null)),
  listMessages,
  saveMessages: async () => Promise.resolve(Result.ok({ messages: [] })),
  saveThread: async () => Promise.resolve(Result.ok(unusedThread)),
  updateThread: async () => Promise.resolve(Result.ok(unusedThread)),
});

const createMemoryCtx = (messages: MastraDBMessage[]) =>
  Kit.createContext(
    createMemoryKit(
      createMemoryApi(async () =>
        Promise.resolve(
          Result.ok({
            messages,
            total: messages.length,
            page: 0,
            perPage: false as const,
            hasMore: false,
          } satisfies StorageListMessagesOutput),
        ),
      ),
    ),
  );

describe("getAttachment", () => {
  it("loads a matching stored file part by sha256", async () => {
    const bytes = new TextEncoder().encode("hello attachment");
    const sha256 = await hashBytes(bytes);
    const data = `data:text/plain;base64,${Buffer.from(bytes).toString("base64")}`;
    const ctx = createMemoryCtx([
      createUserMessage({
        attachments: [{ filename: "notes.txt", mediaType: "text/plain", sha256 }],
        parts: [
          {
            type: "file",
            mimeType: "text/plain",
            data,
          },
        ],
      }),
    ]);

    const file = expectOk(
      await getAttachment(ctx, {
        sha256,
        threadId: THREAD_ID,
      }),
    );

    expect(file).toMatchObject({
      displayName: "notes.txt",
      fileId: sha256,
      mimeType: "text/plain",
      sizeBytes: bytes.byteLength,
    });
    expect(file.bytes).toEqual(bytes);
  });

  it("returns not found when a matching part has no metadata attachment", async () => {
    const bytes = new TextEncoder().encode("fallback");
    const sha256 = await hashBytes(bytes);
    const data = `data:text/markdown;base64,${Buffer.from(bytes).toString("base64")}`;
    const ctx = createMemoryCtx([
      createUserMessage({
        parts: [
          {
            type: "file",
            mimeType: "text/markdown",
            data,
          },
        ],
      }),
    ]);

    const error = expectErr(
      await getAttachment(ctx, {
        sha256,
        threadId: THREAD_ID,
      }),
    );

    expect(GetAttachmentError.is(error)).toBe(true);
    expect(error).toMatchObject({ message: "File not found." });
  });

  it("returns not found when the file part is not a base64 data URL", async () => {
    const bytes = new TextEncoder().encode("hello attachment");
    const sha256 = await hashBytes(bytes);
    const ctx = createMemoryCtx([
      createUserMessage({
        attachments: [{ filename: "notes.txt", mediaType: "text/plain", sha256 }],
        parts: [
          {
            type: "file",
            mimeType: "text/plain",
            data: "https://example.com/notes.txt",
          },
        ],
      }),
    ]);

    const error = expectErr(
      await getAttachment(ctx, {
        sha256,
        threadId: THREAD_ID,
      }),
    );

    expect(GetAttachmentError.is(error)).toBe(true);
    expect(error).toMatchObject({ message: "File not found." });
  });

  it("returns not found when no file part matches", async () => {
    const bytes = new TextEncoder().encode("other");
    const data = `data:text/plain;base64,${Buffer.from(bytes).toString("base64")}`;
    const ctx = createMemoryCtx([
      createUserMessage({
        attachments: [
          {
            filename: "notes.txt",
            mediaType: "text/plain",
            sha256: "a".repeat(64),
          },
        ],
        parts: [
          {
            type: "file",
            mimeType: "text/plain",
            data,
          },
        ],
      }),
    ]);

    const error = expectErr(
      await getAttachment(ctx, {
        sha256: "a".repeat(64),
        threadId: THREAD_ID,
      }),
    );

    expect(GetAttachmentError.is(error)).toBe(true);
    expect(error).toMatchObject({ message: "File not found." });
  });
});
