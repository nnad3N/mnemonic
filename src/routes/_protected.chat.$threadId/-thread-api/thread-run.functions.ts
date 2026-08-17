import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { and, eq, ne } from "drizzle-orm";

import { threadRun } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import { durableAgentsKit } from "@/lib/durable-agents-kit.server";
import { ServerFnError, toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access.middleware";
import { authMiddleware } from "@/lib/middleware/auth.middleware";

import { getThreadStatesFn } from "./thread-run.server";

export const threadRunQueries = {
  all: () => ["thread-run"] as const,
  states: () =>
    queryOptions({
      queryFn: async () => getThreadStates(),
      queryKey: [...threadRunQueries.all(), "states"] as const,
    }),
};

const threadStatesCtx = Kit.createContext(dbKit, durableAgentsKit);

export const getThreadStates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      getThreadStatesFn(threadStatesCtx, { userId: context.user.id }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load thread run state"),
        ReconcileRunsError: () => toServerFnError.serverError("Failed to list active runs"),
      }),
    ),
  );

export const deleteThreadRun = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) => {
    const result = await Kit.get(dbKit).run((db) =>
      db
        .delete(threadRun)
        .where(and(eq(threadRun.threadId, context.thread.id), ne(threadRun.status, "running"))),
    );

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to dismiss the conversation run");
    }
  });

export const stopThreadRun = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) => {
    const result = await Kit.get(dbKit).run((db) =>
      db.query.threadRun.findFirst({
        columns: { runId: true, status: true },
        where: { threadId: context.thread.id },
      }),
    );

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to stop conversation");
    }

    if (result.value?.status !== "running") {
      return;
    }

    const published = await Kit.get(durableAgentsKit).publishCancel({ runId: result.value.runId });

    if (Result.isError(published)) {
      throw toServerFnError.serverError("Failed to stop conversation");
    }
  });
