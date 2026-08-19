import { toAISdkStream } from "@mastra/ai-sdk";
import type { DurableAgentStreamResult } from "@mastra/core/agent/durable";
import type { InferUIMessageChunk } from "ai";
import { createUIMessageStream } from "ai";
import { Result, TaggedError } from "better-result";
import { and, eq, inArray } from "drizzle-orm";

import { threadRun } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import type { DurableAgentsKit, RunTiming } from "@/lib/durable-agents-kit.server";
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
 * nothing depends on a process outliving anything. Returns the run ids it interrupted.
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

  // A run that settled between the DB read and here already wrote its own status.
  const interrupted = yield* await ctx.db.run((db) =>
    db
      .update(threadRun)
      .set({ status: "interrupted", finishedAt: new Date() })
      .where(and(inArray(threadRun.runId, dead), eq(threadRun.status, "running")))
      .returning({ runId: threadRun.runId }),
  );

  for (const run of runs) {
    if (interrupted.some(({ runId }) => runId === run.runId)) {
      const published = await ctx.durableAgents.publishRunEvent({
        ...run,
        status: "interrupted",
      });

      if (Result.isError(published)) {
        console.error(published.error);
      }
    }
  }

  return Result.ok(interrupted.map(({ runId }) => runId));
});

// Work only ever opens or closes, in order, so the count of both is the clock's position.
const countWorkSteps = (timing: RunTiming): number =>
  timing.workTimings.reduce((steps, work) => steps + (work.endedAt ? 2 : 1), 0);

type ToThreadUIStreamInput = {
  cleanup: () => void;
  lastMessageId?: string;
  originalMessages?: ThreadUIMessage[];
  output: DurableAgentStreamResult["output"];
  timing?: RunTiming;
};

export const toThreadUIStream = ({
  cleanup,
  lastMessageId,
  originalMessages,
  output,
  timing,
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

      // The recorder moves the clock as soon as a chunk is published; the matching UI part
      // arrives here a tick later, so the metadata always follows the part that caused it.
      let sentSteps = 0;

      try {
        for await (const part of stream) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          writer.write(part as InferUIMessageChunk<ThreadUIMessage>);

          if (!timing) continue;

          const steps = countWorkSteps(timing);
          if (steps === sentSteps) continue;

          sentSteps = steps;
          writer.write({
            type: "message-metadata",
            messageMetadata: {
              type: "assistant",
              workTimings: timing.workTimings.map((work) => ({ ...work })),
            },
          });
        }
      } finally {
        // The loop only ends once the run's topic is terminal (the writer swallows a gone
        // client), and Mastra's own delayed cleanup clears the topic without unsubscribing,
        // leaking a Redis reader per run.
        cleanup();
      }
    },
  });
