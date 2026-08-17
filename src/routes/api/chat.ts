import { RequestContext } from "@mastra/core/request-context";
import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";
import { matchError, Result, TaggedError } from "better-result";
import { eq } from "drizzle-orm";
import { produce } from "immer";
import * as v from "valibot";

import { threadRun } from "@/db/schema.server";
import { closeWorkSegments } from "@/lib/ai-sdk/close-work-segments";
import { dbKit, type DbKit } from "@/lib/db-kit.server";
import { durableAgentsKit, type DurableAgentsKit } from "@/lib/durable-agents-kit.server";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit, type MemoryKit } from "@/lib/memory-kit.server";
import { authMiddleware } from "@/lib/middleware/auth.middleware";
import { resolveProviderKey } from "@/lib/middleware/resolve-provider-key.server";
import { resolveThread } from "@/lib/middleware/resolve-thread.server";
import { modelCapabilityLevels } from "@/lib/model-capability";
import type { SafeId } from "@/lib/safe-id";
import { createSafeId } from "@/lib/safe-id";
import { getMnemonicAgent } from "@/mastra/agents/id.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";

import { toThreadUIStream } from "./-chat-shared.server";

export const uiMessageSchema = v.object({
  id: v.pipe(v.string(), v.nanoid()),
  role: v.picklist(["system", "user", "assistant"]),
  parts: v.array(v.any()),
  metadata: v.optional(v.any()),
});

const chatRequestSchema = v.object({
  threadId: v.pipe(v.string(), v.nanoid()),
  messages: v.array(uiMessageSchema),
  settings: v.object({
    modelCapability: v.picklist(modelCapabilityLevels),
  }),
  trigger: v.optional(v.picklist(["submit-message", "regenerate-message"])),
  id: v.optional(v.pipe(v.string(), v.nanoid())),
  messageId: v.optional(v.pipe(v.string(), v.nanoid())),
  metadata: v.optional(v.unknown()),
  resourceId: v.optional(v.pipe(v.string(), v.nanoid())),
});

type ChatRequest = v.InferOutput<typeof chatRequestSchema>;

type ChatInput = {
  body: ChatRequest;
  userId: SafeId<"user">;
};

class ChatStreamError extends TaggedError("ChatStreamError")<{
  cause: unknown;
  message: string;
}> {}

type PersistStreamResultInput = {
  completedAt: Temporal.Instant;
  threadId: string;
};

type PersistStreamResultCtx = Kits<[MemoryKit]>;

export const persistStreamResult = Kit.gen(async function* (
  ctx: PersistStreamResultCtx,
  input: PersistStreamResultInput,
) {
  const { messages } = yield* await ctx.memory.listMessages({
    threadId: input.threadId,
    page: 0,
    perPage: false,
  });

  const lastIdx = messages.findLastIndex((message) => message.role === "assistant");

  if (lastIdx === -1) {
    return Result.ok();
  }

  const message = messages.at(lastIdx);

  if (!message) {
    return Result.ok();
  }

  const sealed = produce(message, (draft) => {
    closeWorkSegments(draft.content.parts, input.completedAt);
  });

  if (sealed === message) {
    return Result.ok();
  }

  yield* await ctx.memory.saveMessages({
    messages: [sealed],
  });

  return Result.ok();
});

type ChatCtx = Kits<[DbKit, MemoryKit, DurableAgentsKit]>;

const chatFn = Kit.gen(async function* (ctx: ChatCtx, input: ChatInput) {
  const [{ agentId, thread, topicId }, providerKey] = yield* await Kit.promiseAll([
    resolveThread(ctx, { threadId: input.body.threadId, userId: input.userId }),
    resolveProviderKey(ctx, input.userId),
  ]);

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
        yield* await ctx.memory.deleteMessages({ messageIds });
      }
    }
  }

  const requestContext = new RequestContext<MnemonicRequestContext>();
  requestContext.set("providerKeyId", providerKey.id);
  requestContext.set("userId", input.userId);
  requestContext.set("modelCapability", input.body.settings.modelCapability);
  requestContext.set("threadId", input.body.threadId);

  if (topicId) {
    requestContext.set("filter", { topicId });
  }

  const lastMessage = input.body.messages.at(-1);
  const lastMessageId = lastMessage?.role === "assistant" ? lastMessage.id : undefined;
  const messagesToSend =
    lastMessageId && input.body.trigger === "regenerate-message"
      ? input.body.messages.slice(0, -1)
      : input.body.messages;

  const threadId = input.body.threadId;
  const userId = input.userId;
  const runId = createSafeId<"run">();
  const abortController = new AbortController();

  const [unsubscribeCancel] = yield* await Kit.promiseAll([
    ctx.durableAgents.subscribeCancel({ onCancel: () => abortController.abort(), runId }),
    ctx.durableAgents.connect(),
  ]);

  const settle = async (status: "errored" | "finished" | "interrupted") => {
    await unsubscribeCancel();

    const finishedAt = new Date();
    const recorded = await ctx.db.run((db) =>
      db.update(threadRun).set({ status, finishedAt }).where(eq(threadRun.runId, runId)),
    );

    if (Result.isError(recorded)) {
      console.error(recorded.error);
    }

    const published = await ctx.durableAgents.publishRunEvent({
      finishedAt,
      runId,
      status,
      threadId,
      userId,
    });

    if (Result.isError(published)) {
      console.error(published.error);
    }
  };

  const result = yield* await Result.tryPromise({
    try: async () =>
      getMnemonicAgent(agentId).stream(messagesToSend, {
        abortSignal: abortController.signal,
        maxSteps: 10,
        memory: {
          resource: thread.resourceId,
          thread: threadId,
        },
        requestContext,
        runId,
        untilIdle: true,
        onFinish: async ({ finishReason }) => {
          if (finishReason === "error") return;

          await settle(finishReason === "abort" ? "interrupted" : "finished");
        },
        onError: async () => {
          // Abort and tool-error results are flushed by the durable loop's final step, but a fatal
          // LLM error throws out of the loop before that runs, leaving the work segment open.
          const sealed = await persistStreamResult(ctx, {
            completedAt: Temporal.Now.instant(),
            threadId,
          });

          if (Result.isError(sealed)) {
            console.error(sealed.error);
          }

          await settle("errored");
        },
      }),
    catch: (cause) =>
      new ChatStreamError({
        message: "Chat stream failed",
        cause,
      }),
  });

  const runRow = {
    runId,
    agentId,
    status: "running" as const,
    startedAt: new Date(),
    finishedAt: null,
  };

  yield* await ctx.db.run((db) =>
    db
      .insert(threadRun)
      .values({ threadId, userId, ...runRow })
      .onConflictDoUpdate({ target: threadRun.threadId, set: runRow }),
  );

  const published = await ctx.durableAgents.publishRunEvent({
    finishedAt: null,
    runId,
    status: "running",
    threadId,
    userId,
  });

  if (Result.isError(published)) {
    console.error(published.error);
  }

  return Result.ok(
    toThreadUIStream({
      lastMessageId,
      originalMessages: input.body.messages,
      output: result.output,
    }),
  );
});

const chatCtx = Kit.createContext(dbKit, memoryKit, durableAgentsKit);

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
          body: result.output,
          userId: context.user.id,
        });

        return chatResult.match({
          ok: (stream) => createUIMessageStreamResponse({ stream }),
          err: (error) =>
            matchError(error, {
              ChatStreamError: () => new Response("Internal Server Error", { status: 500 }),
              ProviderKeyNotFoundError: () => new Response("Bad Request", { status: 400 }),
              DatabaseError: () => new Response("Internal Server Error", { status: 500 }),
              EncryptionError: () => new Response("Internal Server Error", { status: 500 }),
              MemoryError: () => new Response("Internal Server Error", { status: 500 }),
              DurableAgentsError: () => new Response("Internal Server Error", { status: 500 }),
              ThreadNotFoundError: () => new Response("Not Found", { status: 404 }),
            }),
        });
      },
    },
  },
});
