import { handleChatStream } from "@mastra/ai-sdk";
import { RequestContext } from "@mastra/core/request-context";
import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";
import { matchError, Result, TaggedError } from "better-result";
import * as v from "valibot";

import type { DbKit } from "@/lib/db-kit";
import { dbKit } from "@/lib/db-kit";
import type { Kits } from "@/lib/kit";
import { Kit } from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { memoryKit } from "@/lib/memory-kit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { DEFAULT_MODEL_CAPABILITY } from "@/lib/model-capability";
import type { SafeId } from "@/lib/safe-id";
import { toSafeId } from "@/lib/safe-id";
import { mastra } from "@/mastra";
import type { MnemonicRequestContext } from "@/mastra/request-context";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

type GetChatAgentIdInput = {
  topicId: SafeId<"topic"> | undefined;
};
export const getChatAgentId = ({ topicId }: GetChatAgentIdInput) =>
  topicId ? "topic-agent" : "conversation-agent";

export const uiMessageSchema = v.object({
  id: v.pipe(v.string(), v.nanoid()),
  role: v.picklist(["system", "user", "assistant"]),
  parts: v.array(v.any()),
  metadata: v.optional(v.any()),
});

const chatRequestSchema = v.pipe(
  v.object({
    threadId: v.pipe(v.string(), v.nanoid()),
    messages: v.array(uiMessageSchema),
    trigger: v.optional(v.picklist(["submit-message", "regenerate-message"])),
    runId: v.optional(v.pipe(v.string(), v.nanoid())),
    resumeData: v.optional(v.record(v.string(), v.unknown())),
    id: v.optional(v.pipe(v.string(), v.nanoid())),
    messageId: v.optional(v.pipe(v.string(), v.nanoid())),
    metadata: v.optional(v.unknown()),
    resourceId: v.optional(v.pipe(v.string(), v.nanoid())),
  }),
  v.forward(
    v.check(
      (input) =>
        input.resumeData === undefined || (input.runId !== undefined && input.runId.length > 0),
    ),
    ["runId"],
  ),
);

type ChatRequest = v.InferOutput<typeof chatRequestSchema>;
type ChatCtx = Kits<[DbKit, MemoryKit]>;

type ChatInput = {
  abortSignal: AbortSignal;
  body: ChatRequest;
  userId: SafeId<"user">;
};

class ChatNotFoundError extends TaggedError("ChatNotFoundError")<{
  message: string;
}>() {}

class ChatStreamError extends TaggedError("ChatStreamError")<{
  cause: unknown;
  message: string;
}>() {}

const chatFn = Kit.gen(async function* (ctx: ChatCtx, input: ChatInput) {
  const thread = yield* await ctx.memory.getThreadById({
    threadId: input.body.threadId,
  });

  if (!thread) {
    return Result.err(new ChatNotFoundError({ message: "Thread not found" }));
  }

  const topic = yield* await ctx.db.run((db) =>
    db.query.topic.findFirst({
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"topic">(thread.resourceId),
        userId: input.userId,
      },
      columns: { id: true },
    }),
  );

  if (thread.resourceId !== input.userId && !topic) {
    return Result.err(new ChatNotFoundError({ message: "Thread not found" }));
  }

  const agentId = getChatAgentId({ topicId: topic?.id });
  const userSettings = yield* await ctx.db.run((db) =>
    db.query.settings.findFirst({
      columns: { modelCapability: true },
      where: { userId: input.userId },
    }),
  );

  if (input.body.messageId) {
    const { messages: storedMessages } = yield* await ctx.memory.listMessages({
      threadId: input.body.threadId,
      page: 0,
      perPage: false,
    });
    const messageIndex = storedMessages.findIndex((message) => message.id === input.body.messageId);
    const editedMessage = messageIndex === -1 ? undefined : storedMessages.at(messageIndex);

    if (editedMessage?.role === "user") {
      const messageIds = storedMessages.slice(messageIndex).map((message) => message.id);

      if (messageIds.length > 0) {
        yield* await ctx.memory.deleteMessages({ agentId, messageIds });
      }
    }
  }

  const requestContext = new RequestContext<MnemonicRequestContext>();
  requestContext.set("userId", input.userId);
  requestContext.set("modelCapability", userSettings?.modelCapability ?? DEFAULT_MODEL_CAPABILITY);
  requestContext.set("threadId", input.body.threadId);

  if (topic) {
    requestContext.set("filter", { topicId: topic.id });
  }

  const stream = yield* await Result.tryPromise({
    try: async () =>
      handleChatStream<ThreadUIMessage>({
        agentId,
        defaultOptions: {
          maxSteps: 10,
        },
        mastra,
        params: {
          ...input.body,
          abortSignal: input.abortSignal,
          memory: {
            resource: thread.resourceId,
            thread: input.body.threadId,
          },
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          messages: input.body.messages as ThreadUIMessage[],
          requestContext,
        },
        sendReasoning: true,
        sendSources: true,
        version: "v6",
      }),
    catch: (cause) =>
      new ChatStreamError({
        message: "Chat stream failed",
        cause,
      }),
  });

  return Result.ok(stream);
});

const chatCtx = Kit.createContext(dbKit, memoryKit);

export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const result = v.safeParse(chatRequestSchema, await request.json());

        if (!result.success) {
          return new Response("Bad Request", { status: 400 });
        }

        const chatResult = await chatFn(chatCtx, {
          abortSignal: request.signal,
          body: result.output,
          userId: context.user.id,
        });

        return chatResult.match({
          ok: (stream) => createUIMessageStreamResponse({ stream }),
          err: (error) =>
            matchError(error, {
              ChatNotFoundError: () => new Response("Not Found", { status: 404 }),
              ChatStreamError: () => new Response("Internal Server Error", { status: 500 }),
              DatabaseError: () => new Response("Internal Server Error", { status: 500 }),
              MemoryError: () => new Response("Internal Server Error", { status: 500 }),
            }),
        });
      },
    },
  },
});
