import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError } from "better-result";
import { produce } from "immer";

import { dbKit } from "@/lib/db-kit.server";
import { durableAgentsKit } from "@/lib/durable-agents-kit.server";
import { ServerFnError, toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access.middleware";
import { authMiddleware } from "@/lib/middleware/auth.middleware";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";

import { deleteThreadRunFn, getThreadStatesFn, stopThreadRunFn } from "./thread-run.server";
import { createThreadTitle } from "./thread.functions";

export const threadRunQueries = {
  all: () => ["thread-run"] as const,
  states: () =>
    queryOptions({
      queryFn: async () => getThreadStates(),
      queryKey: [...threadRunQueries.all(), "states"] as const,
    }),
};

export type CreateThreadTitleVars = {
  threadId: string;
  text: string;
  topicId?: string;
};

export const threadMutations = {
  createTitle: () =>
    mutationOptions({
      mutationFn: async (data: CreateThreadTitleVars) => createThreadTitle({ data }),
      onSuccess: (thread, vars, _onMutateResult, { client }) => {
        if (!thread) return;

        client.setQueryData(sidebarQueries.threads(vars.topicId).queryKey, (current) =>
          produce(current, (draft) => {
            if (!draft) return;

            for (const item of draft) {
              if (item.id === thread.id) {
                item.title = thread.title;
                item.updatedAt = thread.updatedAt;
              }
            }
          }),
        );
      },
    }),
  stop: () =>
    mutationOptions({
      retry: 3,
      mutationFn: async (threadId: string) => stopThreadRun({ data: { threadId } }),
    }),
};

const threadRunCtx = Kit.createContext(dbKit, durableAgentsKit);

export const getThreadStates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      getThreadStatesFn(threadRunCtx, { userId: context.user.id }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load thread run state"),
        ReconcileRunsError: () => toServerFnError.serverError("Failed to list active runs"),
      }),
    ),
  );

export const deleteThreadRun = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      deleteThreadRunFn(threadRunCtx, { threadId: context.thread.id }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to dismiss the conversation run"),
      }),
    ),
  );

export const stopThreadRun = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      stopThreadRunFn(threadRunCtx, { threadId: context.thread.id }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to stop conversation"),
        DurableAgentsError: () => toServerFnError.serverError("Failed to stop conversation"),
      }),
    ),
  );
