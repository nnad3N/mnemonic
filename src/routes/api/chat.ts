import { MessageList } from "@mastra/core/agent/message-list";
import { RequestContext } from "@mastra/core/request-context";
import type { ChunkType } from "@mastra/core/stream";
import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";
import { matchError, Result, TaggedError } from "better-result";
import { eq, inArray } from "drizzle-orm";
import * as v from "valibot";

import { threadReply, threadRun } from "@/db/schema.server";
import { dbKit, type DbKit } from "@/lib/db-kit.server";
import {
  durableAgentsKit,
  type DurableAgentsKit,
  type RunTiming,
} from "@/lib/durable-agents-kit.server";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import { memoryKit, type MemoryKit } from "@/lib/memory-kit.server";
import { authMiddleware } from "@/lib/middleware/auth.middleware";
import { resolveProviderKey } from "@/lib/middleware/resolve-provider-key.server";
import { resolveThread } from "@/lib/middleware/resolve-thread.server";
import { ModelOptions } from "@/lib/model-option";
import type { SafeId } from "@/lib/safe-id";
import { createSafeId } from "@/lib/safe-id";
import { getMnemonicAgent } from "@/mastra/agents/id.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import type { WorkTiming } from "@/routes/_protected.chat.$threadId/-thread-types";

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
    modelOption: v.picklist(ModelOptions.values),
  }),
  trigger: v.optional(v.picklist(["submit-message", "regenerate-message"])),
  id: v.optional(v.pipe(v.string(), v.nanoid())),
  messageId: v.optional(v.pipe(v.string(), v.nanoid())),
  metadata: v.optional(v.unknown()),
});

type ChatRequest = v.InferOutput<typeof chatRequestSchema>;

type ChatInput = {
  body: ChatRequest;
  userId: SafeId<"user">;
};

const WorkStartChunk = Kit.literals.from()([
  "reasoning-start",
  "tool-call-input-streaming-start",
  "tool-call",
] satisfies ChunkType["type"][]);

// Mastra types the finish reason as `string` and its own union omits the `abort` the durable loop
// returns for a cancelled run, so the reason is parsed: a rename upstream throws here instead of
// silently settling a cancelled run as finished.
const finishReasonSchema = v.picklist([
  "abort",
  "content-filter",
  "error",
  "length",
  "other",
  "retry",
  "stop",
  "tool-calls",
  "tripwire",
  "unknown",
]);

class ChatStreamError extends TaggedError("ChatStreamError")<{
  cause: unknown;
  message: string;
}> {}

type ChatCtx = Kits<[DbKit, MemoryKit, DurableAgentsKit]>;

const getOpenWork = (timing: RunTiming): WorkTiming | undefined => {
  const last = timing.workTimings.at(-1);
  return last && !last.endedAt ? last : undefined;
};

const endWork = async (ctx: ChatCtx, runId: SafeId<"run">, timing: RunTiming) => {
  const openWork = getOpenWork(timing);
  if (!openWork) return;

  openWork.endedAt = Temporal.Now.instant().toString();
  const published = await ctx.durableAgents.publishRunTiming({ runId, timing });

  if (Result.isError(published)) {
    console.error(published.error);
  }
};

type SettleRunInput = {
  status: "aborted" | "errored" | "finished";
  runId: SafeId<"run">;
  threadId: string;
  timing: RunTiming;
  userId: SafeId<"user">;
  userMessageId: string;
};

const settleRun = async (
  ctx: ChatCtx,
  { status, runId, threadId, timing, userId, userMessageId }: SettleRunInput,
) => {
  const finishedAt = new Date();
  const [recorded, timed] = await Promise.all([
    ctx.db.run((db) =>
      db.update(threadRun).set({ status, finishedAt }).where(eq(threadRun.runId, runId)),
    ),
    ctx.db.run((db) =>
      db
        .insert(threadReply)
        .values({ userMessageId, threadId, workTimings: timing.workTimings })
        .onConflictDoUpdate({
          target: threadReply.userMessageId,
          set: { workTimings: timing.workTimings },
        }),
    ),
  ]);

  if (Result.isError(recorded)) {
    console.error(recorded.error);
  }

  if (Result.isError(timed)) {
    console.error(timed.error);
  }

  const published = await ctx.durableAgents.publishRunEvent({ runId, status, threadId, userId });

  if (Result.isError(published)) {
    console.error(published.error);
  }
};

const chatFn = Kit.gen(async function* (ctx: ChatCtx, input: ChatInput) {
  const [{ agentId, resourceId, topicId }, providerKey] = yield* await Kit.promiseAll([
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
        yield* await Kit.promiseAll([
          ctx.memory.deleteMessages({ messageIds }),
          ctx.db.run((db) =>
            db.delete(threadReply).where(inArray(threadReply.userMessageId, messageIds)),
          ),
        ]);
      }
    }
  }

  const requestContext = new RequestContext<MnemonicRequestContext>();
  requestContext.set("providerKeyId", providerKey.id);
  requestContext.set("userId", input.userId);
  requestContext.set("modelOption", input.body.settings.modelOption);
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

  const userMessageId = messagesToSend.findLast((message) => message.role === "user")?.id;

  if (!userMessageId) {
    throw new Error("Chat request carries no user message");
  }

  const threadId = input.body.threadId;
  const userId = input.userId;
  const runId = createSafeId<"run">();
  // Mastra stamps a reply's fragments only when each step ends, so the run's own timing is
  // recorded here: streamed to the client as it happens and stored against the user message
  // once settled. Work starts with the first reasoning or tool call, not the request.
  const timing: RunTiming = { workTimings: [] };

  // The durable loop first writes to memory when its second step starts, so a reload during
  // the first would load the thread without the message that started it. Save it now; the
  // loop's flush upserts the same id.
  yield* await Kit.promiseAll([
    ctx.durableAgents.connect(),
    ctx.memory.saveMessages({
      messages: new MessageList({ threadId, resourceId }).add(messagesToSend, "user").get.all.db(),
    }),
  ]);

  const result = yield* await Result.tryPromise({
    try: async () =>
      getMnemonicAgent(agentId).stream(messagesToSend, {
        // Subagents get only the delegation prompt; the parent's history stays out of them.
        delegation: { messageFilter: () => [] },
        maxSteps: 10,
        memory: {
          resource: resourceId,
          thread: threadId,
        },
        requestContext,
        runId,
        untilIdle: true,
        onChunk: async (chunk) => {
          if (chunk.type === "text-start") {
            await endWork(ctx, runId, timing);
          }

          if (WorkStartChunk.is(chunk.type) && !getOpenWork(timing)) {
            timing.workTimings.push({ startedAt: Temporal.Now.instant().toString() });
            (await ctx.durableAgents.publishRunTiming({ runId, timing })).tapError(console.error);
          }
        },
        onFinish: async (event) => {
          const finishReason = v.parse(finishReasonSchema, event.finishReason);

          if (finishReason === "error") return;

          await endWork(ctx, runId, timing);
          await settleRun(ctx, {
            status: finishReason === "abort" ? "aborted" : "finished",
            runId,
            threadId,
            timing,
            userId,
            userMessageId,
          });
        },
        onError: async ({ error }) => {
          console.error(error);

          await endWork(ctx, runId, timing);
          // A fatal error throws out of the durable loop before its final step, which is the
          // only place the reply is written; keep the steps that completed and were shown.
          const saved = await ctx.memory.saveMessages({
            messages: result.output.messageList.get.response.db(),
          });

          if (Result.isError(saved)) {
            console.error(saved.error);
          }

          await settleRun(ctx, {
            status: "errored",
            runId,
            threadId,
            timing,
            userId,
            userMessageId,
          });
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
    versionedNoteIds: [],
    startedAt: new Date(),
    finishedAt: null,
  };

  const [unsubscribeCancel] = yield* await Kit.promiseAll([
    ctx.durableAgents.subscribeCancel({
      onCancel: () => {
        void result.abort().catch(console.error);
      },
      runId,
    }),
    ctx.db.run((db) =>
      db
        .insert(threadRun)
        .values({ threadId, userId, ...runRow })
        .onConflictDoUpdate({ target: threadRun.threadId, set: runRow }),
    ),
  ]);

  const published = await ctx.durableAgents.publishRunEvent({
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
      cleanup: () => {
        result.cleanup();
        void unsubscribeCancel().then((r) => r.tapError(console.error));
      },
      lastMessageId,
      originalMessages: input.body.messages,
      output: result.output,
      timing,
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
