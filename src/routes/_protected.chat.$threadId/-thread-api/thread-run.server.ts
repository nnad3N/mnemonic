import { Result } from "better-result";
import { and, eq, ne } from "drizzle-orm";

import type { ThreadRunStatus } from "@/db/schema.server";
import { threadRun } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import type { DurableAgentsKit } from "@/lib/durable-agents-kit.server";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";
import { reconcileRuns } from "@/routes/api/-chat-shared.server";

export type ThreadRunState = {
  status: ThreadRunStatus;
  threadId: string;
};

type GetThreadStatesCtx = Kits<[DbKit, DurableAgentsKit]>;

type GetThreadStatesInput = {
  userId: SafeId<"user">;
};

export const getThreadStatesFn = Kit.gen(async function* (
  ctx: GetThreadStatesCtx,
  input: GetThreadStatesInput,
) {
  const runs = yield* await ctx.db.run((db) =>
    db
      .select({
        runId: threadRun.runId,
        status: threadRun.status,
        threadId: threadRun.threadId,
      })
      .from(threadRun)
      .where(eq(threadRun.userId, input.userId)),
  );

  const dead = yield* await reconcileRuns(
    ctx,
    runs
      .filter((run) => run.status === "running")
      .map(({ runId, threadId }) => ({ runId, threadId, userId: input.userId })),
  );

  const states: ThreadRunState[] = runs.map(({ runId, ...run }) =>
    dead.includes(runId) ? { ...run, status: "interrupted" } : run,
  );

  return Result.ok(states);
});

type StopThreadRunCtx = Kits<[DbKit, DurableAgentsKit]>;

type StopThreadRunInput = {
  threadId: string;
};

export const stopThreadRunFn = Kit.gen(async function* (
  ctx: StopThreadRunCtx,
  input: StopThreadRunInput,
) {
  const run = yield* await ctx.db.run((db) =>
    db.query.threadRun.findFirst({
      columns: { runId: true, status: true },
      where: { threadId: input.threadId },
    }),
  );

  if (run?.status !== "running") {
    return Result.ok();
  }

  yield* await ctx.durableAgents.publishCancel({ runId: run.runId });

  return Result.ok();
});

type DeleteThreadRunCtx = Kits<[DbKit]>;

type DeleteThreadRunInput = {
  threadId: string;
};

export const deleteThreadRunFn = Kit.gen(async function* (
  ctx: DeleteThreadRunCtx,
  input: DeleteThreadRunInput,
) {
  yield* await ctx.db.run((db) =>
    db
      .delete(threadRun)
      .where(and(eq(threadRun.threadId, input.threadId), ne(threadRun.status, "running"))),
  );

  return Result.ok();
});
