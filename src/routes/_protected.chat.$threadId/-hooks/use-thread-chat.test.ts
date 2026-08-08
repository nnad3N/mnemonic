import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { getMessagesToSend } from "./use-thread-chat";

const message = (id: string, role: UIMessage["role"]): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text: id }],
});

describe("getMessagesToSend", () => {
  it("returns an empty list when there are no messages", () => {
    expect(getMessagesToSend([], "submit-message")).toEqual([]);
  });

  it("returns only the last message for a normal submit", () => {
    const messages = [message("u1", "user"), message("a1", "assistant"), message("u2", "user")];

    expect(getMessagesToSend(messages, "submit-message").map((item) => item.id)).toEqual(["u2"]);
  });

  it("returns the previous user message with the assistant on regenerate", () => {
    const messages = [message("u1", "user"), message("a1", "assistant")];

    expect(getMessagesToSend(messages, "regenerate-message").map((item) => item.id)).toEqual([
      "u1",
      "a1",
    ]);
  });

  it("returns only the last message when regenerating without a previous message", () => {
    const messages = [message("a1", "assistant")];

    expect(getMessagesToSend(messages, "regenerate-message").map((item) => item.id)).toEqual([
      "a1",
    ]);
  });

  it("sends only the user message when regenerating from a trailing user turn", () => {
    // The assistant reply failed before it was appended, so there is nothing to
    // regenerate from — the user turn is resent on its own.
    const messages = [message("u1", "user"), message("a1", "assistant"), message("u2", "user")];

    expect(getMessagesToSend(messages, "regenerate-message").map((item) => item.id)).toEqual([
      "u2",
    ]);
  });
});
