import { Chat } from "@ai-sdk/react";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getThread } from "../-thread-api/thread.functions";
import type { ThreadUIMessage } from "../-thread-types";
import { getMessagesToSend, resumeThreadStream } from "./use-thread-chat";

// The restore path fetches the thread over a server fn, which has no server in tests.
// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock("../-thread-api/thread.functions", () => ({
  getThread: vi.fn<(typeof import("../-thread-api/thread.functions"))["getThread"]>(),
}));

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

const threadMessages = (): ThreadUIMessage[] => [
  { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
  { id: "reply", role: "assistant", parts: [{ type: "reasoning", text: "thinking" }] },
];

// The run streams under its first fragment's id, which differs from the id the loaded
// thread's merged reply carries.
const replayStream = () =>
  new ReadableStream<UIMessageChunk<ThreadUIMessage>>({
    start(controller) {
      controller.enqueue({ type: "start", messageId: "replayed" });
      controller.enqueue({ type: "start-step" });
      controller.enqueue({ type: "reasoning-start", id: "r1" });
      controller.enqueue({ type: "reasoning-delta", id: "r1", delta: "thinking" });
      controller.enqueue({ type: "reasoning-end", id: "r1" });
      controller.close();
    },
  });

const makeChat = (
  reconnectToStream: ChatTransport<ThreadUIMessage>["reconnectToStream"],
): Chat<ThreadUIMessage> =>
  new Chat<ThreadUIMessage>({
    id: "thread1",
    messages: threadMessages(),
    onError: () => {},
    transport: {
      sendMessages: () => {
        throw new Error("resume never sends messages");
      },
      reconnectToStream,
    },
  });

describe("resumeThreadStream", () => {
  beforeEach(() => {
    vi.mocked(getThread).mockResolvedValue({
      // oxlint-disable-next-line anti-slop/require-safety-comment-for-type-assertion, typescript/no-unsafe-type-assertion
      messages: threadMessages() as Awaited<ReturnType<typeof getThread>>["messages"],
      topicId: undefined,
    });
  });

  it("rebuilds the reply from the replay without duplicating it", async () => {
    const chat = makeChat(async () => Promise.resolve(replayStream()));

    await resumeThreadStream(chat);

    expect(chat.messages.map((item) => item.role)).toEqual(["user", "assistant"]);
    expect(chat.lastMessage?.id).toBe("replayed");
    expect(chat.lastMessage?.parts.filter((part) => part.type === "reasoning")).toHaveLength(1);
  });

  it("restores the reply when there is no run to attach to", async () => {
    const chat = makeChat(async () => Promise.resolve(null));

    await resumeThreadStream(chat);

    expect(getThread).toHaveBeenCalledOnce();
    expect(chat.messages.map((item) => item.id)).toEqual(["u1", "reply"]);
  });

  it("ignores a second call while an attempt is in flight", async () => {
    let rejectReconnect!: (error: Error) => void;
    const reconnectToStream = vi.fn<ChatTransport<ThreadUIMessage>["reconnectToStream"]>(
      async () =>
        new Promise((_resolve, reject) => {
          rejectReconnect = reject;
        }),
    );
    const chat = makeChat(reconnectToStream);

    // A route remount fires the resume effect again while the first attempt still awaits its
    // reconnect. Without the single-flight guard the second request aborts the first, whose
    // restore then races the second request's message snapshot into a duplicated reply.
    const first = resumeThreadStream(chat);
    const second = resumeThreadStream(chat);
    rejectReconnect(new Error("connection lost"));
    await Promise.all([first, second]);

    expect(reconnectToStream).toHaveBeenCalledOnce();
    expect(chat.messages.map((item) => item.id)).toEqual(["u1", "reply"]);
  });
});
