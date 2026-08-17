import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";
import { matchError, Result, TaggedError } from "better-result";

import type { DbKit } from "@/lib/db-kit.server";
import { dbKit } from "@/lib/db-kit.server";
import type { DurableAgentsKit } from "@/lib/durable-agents-kit.server";
import { durableAgentsKit } from "@/lib/durable-agents-kit.server";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit.server";
import { memoryKit } from "@/lib/memory-kit.server";
import { authMiddleware } from "@/lib/middleware/auth.middleware";
import { resolveThread } from "@/lib/middleware/resolve-thread.server";
import type { SafeId } from "@/lib/safe-id";
import { getMnemonicAgent } from "@/mastra/agents/id.server";

import { reconcileRuns, toThreadUIStream } from "./-chat-shared.server";

/**
 * `observe` blocks forever on a topic whose producer died without a terminal event; this only has
 * to outlast the longest quiet stretch inside one tool call, `isAlive` catches the rest.
 */
const OBSERVE_IDLE_MS = 60 * 1000;

class ActiveRunError extends TaggedError("ActiveRunError")<{
  message: string;
}> {}

type ReconnectInput = {
  threadId: string;
  userId: SafeId<"user">;
};

type ChatCtx = Kits<[DbKit, MemoryKit, DurableAgentsKit]>;

const reconnectFn = Kit.gen(async function* (ctx: ChatCtx, input: ReconnectInput) {
  const [{ agentId }, run] = yield* await Kit.promiseAll([
    resolveThread(ctx, {
      threadId: input.threadId,
      userId: input.userId,
    }),
    ctx.db.run((db) =>
      db.query.threadRun.findFirst({
        where: { threadId: input.threadId },
        columns: { runId: true, status: true },
      }),
    ),
  ]);

  if (run?.status !== "running") {
    return Result.err(new ActiveRunError({ message: "No active run" }));
  }

  const runId = run.runId;

  const dead = yield* await reconcileRuns(ctx, [
    { runId, threadId: input.threadId, userId: input.userId },
  ]);

  if (dead.includes(runId)) {
    return Result.err(new ActiveRunError({ message: "No active run" }));
  }

  yield* await ctx.durableAgents.connect();

  const result = yield* await Result.tryPromise({
    try: async () =>
      getMnemonicAgent(agentId).observe(runId, {
        idleTimeoutMs: OBSERVE_IDLE_MS,
        isAlive: async () => {
          const current = await ctx.db.run((db) =>
            db.query.threadRun.findFirst({ where: { runId }, columns: { status: true } }),
          );

          // A transient read failure must not kill a live stream.
          return Result.isError(current) || current.value?.status === "running";
        },
      }),
    catch: () => new ActiveRunError({ message: "Run is no longer observable" }),
  });

  return Result.ok(toThreadUIStream({ output: result.output }));
});

const reconnectCtx = Kit.createContext(dbKit, memoryKit, durableAgentsKit);

export const Route = createFileRoute("/api/chat/$threadId/stream")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ context, params }) => {
        const result = await reconnectFn(reconnectCtx, {
          threadId: params.threadId,
          userId: context.user.id,
        });

        return result.match({
          ok: (stream) => createUIMessageStreamResponse({ stream }),
          err: (error) =>
            matchError(error, {
              // AI SDK's transport resolves 204 to `null`: nothing to reattach to.
              ActiveRunError: () => new Response(null, { status: 204 }),
              DatabaseError: () => new Response("Internal Server Error", { status: 500 }),
              MemoryError: () => new Response("Internal Server Error", { status: 500 }),
              DurableAgentsError: () => new Response("Internal Server Error", { status: 500 }),
              ThreadNotFoundError: () => new Response("Not Found", { status: 404 }),
              ReconcileRunsError: () => new Response("Internal Server Error", { status: 500 }),
            }),
        });
      },
    },
  },
});
