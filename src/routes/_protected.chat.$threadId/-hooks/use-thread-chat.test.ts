import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import { getAbortedMessagePatch, getMessagesToSend } from "./use-thread-chat";

const message = (id: string, role: UIMessage["role"]): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text: id }],
});

describe("getAbortedMessagePatch", () => {
  it("returns empty add and no deletes when there are no messages", () => {
    expect(getAbortedMessagePatch([], new Set())).toEqual({ add: [], deleteIds: [] });
  });

  it("adds the trailing user turn with no deletes on a fresh abort", () => {
    const messages = [message("u1", "user"), message("a1", "assistant"), message("u2", "user")];

    expect(getAbortedMessagePatch(messages, new Set(["u1", "a1"]))).toEqual({
      add: [messages.at(2)],
      deleteIds: [],
    });
  });

  it("adds the user and partial assistant for an aborted reply", () => {
    const messages = [
      message("u1", "user"),
      message("a1", "assistant"),
      message("u2", "user"),
      message("a2", "assistant"),
    ];

    expect(getAbortedMessagePatch(messages, new Set(["u1", "a1"]))).toEqual({
      add: [messages.at(2), messages.at(3)],
      deleteIds: [],
    });
  });

  it("deletes persisted ids that are no longer in the live thread", () => {
    // Edit truncated the thread client-side; storage still had the tail until chat deleted it.
    const messages = [message("u1", "user"), message("u2", "user"), message("a2", "assistant")];

    expect(getAbortedMessagePatch(messages, new Set(["u1", "a1", "u2", "a2-old"]))).toEqual({
      add: [messages.at(1), messages.at(2)],
      deleteIds: ["a1", "a2-old"],
    });
  });

  it("does not delete ids that are still live (add overwrites instead)", () => {
    const messages = [message("u1", "user"), message("a1", "assistant")];

    expect(getAbortedMessagePatch(messages, new Set(["u1", "a1"]))).toEqual({
      add: [messages.at(0), messages.at(1)],
      deleteIds: [],
    });
  });
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
