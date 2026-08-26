import { convertFileListToFileUIParts } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThreadUIMessage, UserMessageMetadata } from "../-thread-types";
import { useChatStore } from "../../-chat-store";
import { getComposerAttachments } from "./use-composer-actions";

// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  return {
    ...actual,
    // happy-dom's DataTransfer.files is an Array, not a FileList — the real
    // converter rejects that. Stub the conversion so we can test selection/merge.
    convertFileListToFileUIParts: vi.fn<typeof convertFileListToFileUIParts>(async (files) =>
      Promise.resolve(
        Array.from(files ?? []).map((file) => ({
          type: "file" as const,
          mediaType: file.type,
          filename: file.name,
          url: `data:${file.type};base64,stub`,
        })),
      ),
    ),
  };
});

const userMessage = (input: {
  id: string;
  attachments?: UserMessageMetadata["attachments"];
  files?: Extract<ThreadUIMessage["parts"][number], { type: "file" }>[];
}): ThreadUIMessage => ({
  id: input.id,
  role: "user",
  parts: [{ type: "text", text: input.id }, ...(input.files ?? [])],
  metadata: !input.attachments ? undefined : { type: "user", attachments: input.attachments },
});

describe("getComposerAttachments", () => {
  beforeEach(() => {
    vi.mocked(convertFileListToFileUIParts).mockClear();
  });

  it("returns no files and undefined attachments when nothing is ready", async () => {
    const result = await getComposerAttachments("thread-1", [], "main");

    expect(result).toEqual({ files: [], attachments: undefined });
    expect(convertFileListToFileUIParts).not.toHaveBeenCalled();
  });

  it("includes draft attachments for the requested location", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    useChatStore.getState().upsertAttachment("thread-1", {
      status: "draft",
      location: "main",
      filename: "notes.txt",
      sha256: "abc",
      file,
    });

    const result = await getComposerAttachments("thread-1", [], "main");

    expect(result.attachments).toEqual([
      { filename: "notes.txt", mediaType: "text/plain", sha256: "abc" },
    ]);
    expect(result.files).toEqual([
      {
        type: "file",
        filename: "notes.txt",
        mediaType: "text/plain",
        url: "data:text/plain;base64,stub",
      },
    ]);
    expect(convertFileListToFileUIParts).toHaveBeenCalledOnce();
  });

  it("skips persisted and wrong-location attachments", async () => {
    const editDraft = new File(["edit"], "edit.txt", { type: "text/plain" });

    useChatStore.getState().upsertAttachment("thread-1", {
      status: "draft",
      location: "edit",
      filename: "edit.txt",
      sha256: "edit",
      file: editDraft,
    });
    useChatStore.getState().upsertAttachment("thread-1", {
      status: "persisted",
      filename: "persisted.pdf",
      sha256: "persisted",
    });

    const result = await getComposerAttachments("thread-1", [], "main");

    expect(result).toEqual({ files: [], attachments: undefined });
    expect(convertFileListToFileUIParts).not.toHaveBeenCalled();
  });

  it("includes the edited message metadata attachments and file parts", async () => {
    useChatStore.getState().setEditingState({
      messageId: "msg-1",
      markdown: "hi",
    });

    const messages = [
      userMessage({
        id: "msg-1",
        attachments: [{ filename: "kept.pdf", mediaType: "application/pdf", sha256: "kept" }],
        files: [
          {
            type: "file",
            filename: "kept.pdf",
            mediaType: "application/pdf",
            url: "https://example.com/kept.pdf",
          },
        ],
      }),
    ];

    const result = await getComposerAttachments("thread-1", messages, "edit");

    expect(result.attachments).toEqual([
      { filename: "kept.pdf", mediaType: "application/pdf", sha256: "kept" },
    ]);
    expect(result.files).toEqual([
      {
        type: "file",
        filename: "kept.pdf",
        mediaType: "application/pdf",
        url: "https://example.com/kept.pdf",
      },
    ]);
  });

  it("merges edited message attachments with new draft store attachments", async () => {
    const file = new File(["new"], "new.txt", { type: "text/plain" });

    useChatStore.getState().setEditingState({
      messageId: "msg-1",
      markdown: "hi",
    });
    useChatStore.getState().upsertAttachment("thread-1", {
      status: "draft",
      location: "edit",
      filename: "new.txt",
      sha256: "new",
      file,
    });

    const messages = [
      userMessage({
        id: "msg-1",
        attachments: [{ filename: "kept.pdf", mediaType: "application/pdf", sha256: "kept" }],
      }),
    ];

    const result = await getComposerAttachments("thread-1", messages, "edit");

    expect(result.attachments).toEqual([
      { filename: "kept.pdf", mediaType: "application/pdf", sha256: "kept" },
      { filename: "new.txt", mediaType: "text/plain", sha256: "new" },
    ]);
    expect(result.files).toEqual([
      {
        type: "file",
        filename: "new.txt",
        mediaType: "text/plain",
        url: "data:text/plain;base64,stub",
      },
    ]);
  });

  it("ignores editing state when the edited message is missing", async () => {
    useChatStore.getState().setEditingState({
      messageId: "missing",
      markdown: "hi",
    });

    const result = await getComposerAttachments("thread-1", [userMessage({ id: "other" })], "edit");

    expect(result).toEqual({ files: [], attachments: undefined });
  });
});
