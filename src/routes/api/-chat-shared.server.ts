import { toAISdkStream } from "@mastra/ai-sdk";
import type { DurableAgentStreamResult } from "@mastra/core/agent/durable";
import type { InferUIMessageChunk } from "ai";
import { createUIMessageStream } from "ai";
import { Result, TaggedError } from "better-result";
import { inArray } from "drizzle-orm";

import { threadRun } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import type { DurableAgentsKit } from "@/lib/durable-agents-kit.server";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";
import { getMnemonicAgent, MnemonicAgentIds } from "@/mastra/agents/id.server";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

class ReconcileRunsError extends TaggedError("ReconcileRunsError")<{
  message: string;
  cause: unknown;
}> {}

type Run = {
  runId: SafeId<"run">;
  threadId: string;
  userId: SafeId<"user">;
};

type ReconcileRunsCtx = Kits<[DbKit, DurableAgentsKit]>;

/**
 * A run that dies with its process never reaches its terminal callback, so its row stays
 * `running` with nothing left to flip it. Settled at read time rather than by a boot job so
 * nothing depends on a process outliving anything. Returns the run ids that turned out dead.
 */
export const reconcileRuns = Kit.gen(async function* (ctx: ReconcileRunsCtx, runs: Run[]) {
  if (runs.length === 0) {
    return Result.ok([]);
  }

  const alive: string[] = [];

  for (const agentId of MnemonicAgentIds.values) {
    const listed = yield* await Result.tryPromise({
      try: async () => getMnemonicAgent(agentId).listActiveRuns(),
      catch: (cause) => new ReconcileRunsError({ message: "Failed to list active runs", cause }),
    });

    alive.push(...listed.runs.map((run) => run.runId));
  }

  const dead = runs.map((run) => run.runId).filter((runId) => !alive.includes(runId));

  if (dead.length === 0) {
    return Result.ok(dead);
  }

  const finishedAt = new Date();

  yield* await ctx.db.run((db) =>
    db
      .update(threadRun)
      .set({ status: "interrupted", finishedAt })
      .where(inArray(threadRun.runId, dead)),
  );

  for (const run of runs) {
    if (dead.includes(run.runId)) {
      const published = await ctx.durableAgents.publishRunEvent({
        ...run,
        finishedAt,
        status: "interrupted",
      });

      if (Result.isError(published)) {
        console.error(published.error);
      }
    }
  }

  return Result.ok(dead);
});

type ToThreadUIStreamInput = {
  lastMessageId?: string;
  originalMessages?: ThreadUIMessage[];
  output: DurableAgentStreamResult["output"];
};

export const toThreadUIStream = ({
  lastMessageId,
  originalMessages,
  output,
}: ToThreadUIStreamInput) =>
  createUIMessageStream<ThreadUIMessage>({
    originalMessages,
    execute: async ({ writer }) => {
      const stream = toAISdkStream(output, {
        from: "agent",
        version: "v6",
        lastMessageId,
        sendReasoning: true,
        sendSources: true,
      });

      for await (const part of stream) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        writer.write(part as InferUIMessageChunk<ThreadUIMessage>);
      }
    },
  });
