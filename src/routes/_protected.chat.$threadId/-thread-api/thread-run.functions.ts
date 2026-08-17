import { EventEmitter, on } from "node:events";

import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { matchError, Result } from "better-result";

import { threadSettings } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import { durableAgentsKit, type ThreadRunEvent } from "@/lib/durable-agents-kit.server";
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

export const streamThreadRunEvents = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async function* ({ context }) {
    const emitter = new EventEmitter<{ event: [ThreadRunEvent] }>();

    const subscribed = await Kit.get(durableAgentsKit).subscribeRunEvents({
      onEvent: (event) => {
        emitter.emit("event", event);
      },
      userId: context.user.id,
    });

    if (Result.isError(subscribed)) {
      throw toServerFnError.serverError("Failed to subscribe to thread run events");
    }

    try {
      for await (const [event] of on(emitter, "event", { signal: getRequest().signal })) {
        yield event;
      }
    } finally {
      await subscribed.value();
    }
  });

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

export const markThreadViewed = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) => {
    const viewedAt = new Date();

    const result = await Kit.get(dbKit).run((db) =>
      db
        .insert(threadSettings)
        .values({
          threadId: context.thread.id,
          userId: context.user.id,
          viewedAt,
        })
        .onConflictDoUpdate({
          target: threadSettings.threadId,
          set: { viewedAt },
        }),
    );

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to mark conversation as viewed");
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
