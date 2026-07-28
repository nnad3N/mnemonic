import { describe, expect, it } from "vitest";

import { useChatStore } from "./-chat-store";
import type { ThreadUIMessage } from "./_protected.chat.$threadId/-thread-types";

const userMessageWithAttachments = (
  id: string,
  attachments: NonNullable<ThreadUIMessage["metadata"]>["attachments"],
): ThreadUIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text: id }],
  metadata: { attachments },
});

describe("useChatStore attachments", () => {
  it("upserts and replaces an attachment by sha256", () => {
    const threadId = "thread-upsert";
    const file = new File(["a"], "a.txt");

    useChatStore.getState().upsertAttachment(threadId, {
      status: "pending",
      location: "main",
      filename: "a.txt",
      sha256: "abc",
      file,
    });
    useChatStore.getState().upsertAttachment(threadId, {
      status: "ready",
      location: "main",
      filename: "a.txt",
      sha256: "abc",
      file,
    });

    expect(useChatStore.getState().attachments.get(threadId)).toEqual([
      {
        status: "ready",
        location: "main",
        filename: "a.txt",
        sha256: "abc",
        file,
      },
    ]);
  });

  it("does not remove persisted attachments", () => {
    const threadId = "thread-persisted";

    useChatStore.getState().upsertAttachment(threadId, {
      status: "persisted",
      filename: "kept.pdf",
      sha256: "persist",
    });
    useChatStore.getState().removeAttachment(threadId, "persist");

    expect(useChatStore.getState().attachments.get(threadId)?.at(0)?.status).toBe("persisted");
  });

  it("removes non-persisted attachments by sha256", () => {
    const threadId = "thread-remove";
    const file = new File(["x"], "draft.txt");

    useChatStore.getState().upsertAttachment(threadId, {
      status: "pending",
      location: "main",
      filename: "draft.txt",
      sha256: "draft",
      file,
    });
    useChatStore.getState().removeAttachment(threadId, "draft");

    expect(useChatStore.getState().attachments.get(threadId) ?? []).toEqual([]);
  });

  it("hydrates persisted attachments and keeps non-persisted orphans", () => {
    const threadId = "thread-hydrate";
    const file = new File(["x"], "draft.txt");

    useChatStore.getState().upsertAttachment(threadId, {
      status: "pending",
      location: "main",
      filename: "draft.txt",
      sha256: "draft",
      file,
    });
    useChatStore.getState().upsertAttachment(threadId, {
      status: "persisted",
      filename: "old.pdf",
      sha256: "old",
    });

    const messages = [
      userMessageWithAttachments("m1", [
        { filename: "kept.pdf", sha256: "kept", mediaType: "application/pdf" },
      ]),
    ];

    useChatStore.getState().hydrateAttachments(threadId, messages);

    const attachments = useChatStore.getState().attachments.get(threadId) ?? [];
    expect(attachments.map((item) => item.sha256).sort()).toEqual(["draft", "kept"]);
    expect(attachments.find((item) => item.sha256 === "old")).toBeUndefined();
  });
});
