import { Result } from "better-result";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { beforeEach, describe, expect, it } from "vitest";

import type { ThreadRunStatus } from "@/db/schema.server";
import { threadRun } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import type { DbKit } from "@/lib/db-kit.server";
import type { DurableAgentsApi, DurableAgentsKit } from "@/lib/durable-agents-kit.server";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { clearDatabase } from "@/test/clear-database";
import { expectOk } from "@/test/result";
import { seedUser } from "@/test/seed";

import { deleteThreadRunFn, stopThreadRunFn } from "./thread-run.server";

const db = Kit.get(dbKit);

const createFakeDurableAgentsKit = (cancelled: SafeId<"run">[]) => {
  const api: DurableAgentsApi = {
    connect: async () => Promise.resolve(Result.ok()),
    publishCancel: async ({ runId }) => {
      cancelled.push(runId);

      return Promise.resolve(Result.ok());
    },
    publishRunEvent: async () => Promise.resolve(Result.ok()),
    publishRunTiming: async () => Promise.resolve(Result.ok()),
    subscribeCancel: async () =>
      Promise.resolve(Result.ok(async () => Promise.resolve(Result.ok()))),
    subscribeRunEvents: async () =>
      Promise.resolve(Result.ok(async () => Promise.resolve(Result.ok()))),
    subscribeRunTiming: async () =>
      Promise.resolve(Result.ok(async () => Promise.resolve(Result.ok()))),
  };

  return Kit.define("durableAgents", api);
};

const seedRun = async (input: { status: ThreadRunStatus; userId: string }) => {
  const runId = createSafeId<"run">();
  const threadId = nanoid();

  expectOk(
    await db.run((database) =>
      database.insert(threadRun).values({
        agentId: "conversation-agent",
        runId,
        status: input.status,
        threadId,
        userId: toSafeId<"user">(input.userId),
      }),
    ),
  );

  return { runId, threadId };
};

const runStatuses = async () => {
  const result = await db.run((database) =>
    database.query.threadRun.findMany({ columns: { status: true } }),
  );

  return expectOk(result).map((row) => row.status);
};

describe("thread runs", () => {
  let userId: string;
  let cancelled: SafeId<"run">[];
  let ctx: Kits<[DbKit, DurableAgentsKit]>;

  beforeEach(async () => {
    await clearDatabase();
    userId = await seedUser();
    cancelled = [];
    ctx = Kit.createContext(dbKit, createFakeDurableAgentsKit(cancelled));
  });

  it("publishes cancel while the run is running and nothing once it settled", async () => {
    const { runId, threadId } = await seedRun({ status: "running", userId });

    expectOk(await stopThreadRunFn(ctx, { threadId }));
    expectOk(await stopThreadRunFn(ctx, { threadId }));

    expect(cancelled).toEqual([runId, runId]);

    expectOk(
      await db.run((database) =>
        database
          .update(threadRun)
          .set({ status: "aborted" })
          .where(eq(threadRun.threadId, threadId)),
      ),
    );

    expectOk(await stopThreadRunFn(ctx, { threadId }));

    expect(cancelled).toEqual([runId, runId]);
  });

  it("delete removes a settled run and keeps a running one", async () => {
    const running = await seedRun({ status: "running", userId });
    const finished = await seedRun({ status: "finished", userId });

    expectOk(await deleteThreadRunFn(ctx, { threadId: finished.threadId }));
    expectOk(await deleteThreadRunFn(ctx, { threadId: running.threadId }));

    expect(await runStatuses()).toEqual(["running"]);
  });
});
