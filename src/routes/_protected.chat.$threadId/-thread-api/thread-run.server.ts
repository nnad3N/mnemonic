import { Result } from "better-result";
import { eq } from "drizzle-orm";

import type { ThreadRunStatus } from "@/db/schema.server";
import { threadRun, threadSettings } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import type { DurableAgentsKit } from "@/lib/durable-agents-kit.server";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";
import { reconcileRuns } from "@/routes/api/-chat-shared.server";

export type ThreadRunState = {
  finishedAt: Date | null;
  status: ThreadRunStatus;
  threadId: string;
  viewedAt: Date | null;
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
        finishedAt: threadRun.finishedAt,
        runId: threadRun.runId,
        status: threadRun.status,
        threadId: threadRun.threadId,
        viewedAt: threadSettings.viewedAt,
      })
      .from(threadRun)
      .leftJoin(threadSettings, eq(threadSettings.threadId, threadRun.threadId))
      .where(eq(threadRun.userId, input.userId)),
  );

  const dead = yield* await reconcileRuns(
    ctx,
    runs
      .filter((run) => run.status === "running")
      .map(({ runId, threadId }) => ({ runId, threadId, userId: input.userId })),
  );

  const states: ThreadRunState[] = runs.map(({ runId, ...run }) =>
    dead.includes(runId) ? { ...run, status: "interrupted", finishedAt: new Date() } : run,
  );

  return Result.ok(states);
});
