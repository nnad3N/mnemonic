import { describe, expect, it } from "vitest";

import { hashFileContents } from "@/lib/hash";

import { withUniqueClipboardImageName } from "../-thread-components/composer/plate-plugins/file";
import type { ThreadUIMessage } from "../-thread-types";
import { useChatStore } from "../../-chat-store";
import { findAttachmentFilename } from "./use-composer-upload";

describe("findAttachmentFilename", () => {
  it("reuses the first attachment name when the same file is pasted twice", async () => {
    const source = () => new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" });

    const firstPaste = withUniqueClipboardImageName(source());
    const secondPaste = withUniqueClipboardImageName(source());

    expect(firstPaste.name).not.toBe(secondPaste.name);

    const sha256 = await hashFileContents(firstPaste);
    expect(await hashFileContents(secondPaste)).toBe(sha256);

    useChatStore.getState().upsertAttachment("thread-1", {
      status: "ready",
      location: "main",
      filename: firstPaste.name,
      sha256,
      file: firstPaste,
    });

    // uploadFiles uses existingFilename ?? file.name for the mention text
    expect(findAttachmentFilename("thread-1", [], sha256) ?? secondPaste.name).toBe(
      firstPaste.name,
    );
  });

  it("reuses a filename already sent on a prior message", async () => {
    const file = new File([new Uint8Array([9])], "notes.txt", { type: "text/plain" });
    const sha256 = await hashFileContents(file);

    const messages: ThreadUIMessage[] = [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "hi" }],
        metadata: {
          attachments: [{ filename: "notes.txt", mediaType: "text/plain", sha256 }],
        },
      },
    ];

    const secondPaste = new File([new Uint8Array([9])], "notes (copy).txt", {
      type: "text/plain",
    });

    expect(findAttachmentFilename("thread-1", messages, sha256) ?? secondPaste.name).toBe(
      "notes.txt",
    );
  });
});
