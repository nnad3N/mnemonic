import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as v from "valibot";

import { topic } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import { duration } from "@/lib/durations";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access.middleware";
import { authMiddleware } from "@/lib/middleware/auth.middleware";
import { getResourceId } from "@/lib/middleware/resolve-thread.server";

import { listSidebarConversationsFn, toSidebarThread } from "./sidebar.server";
export type { SidebarThread } from "./sidebar.server";

const sidebarCtx = Kit.createContext(dbKit, memoryKit);

export const listSidebarConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      listSidebarConversationsFn(sidebarCtx, {
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        MemoryError: () => toServerFnError.serverError("Failed to list conversations"),
      }),
    ),
  );

export const listSidebarTopics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const result = await Kit.get(dbKit).run(async (db) =>
      db
        .select({ id: topic.id, title: topic.title })
        .from(topic)
        .where(eq(topic.userId, context.user.id))
        .orderBy(desc(topic.updatedAt)),
    );

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to list topics");
    }

    return result.value;
  });

export const listSidebarTopicThreads = createServerFn({ method: "GET" })
  .validator(v.object({ topicId: v.pipe(v.string(), v.nanoid()) }))
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const result = await Kit.get(memoryKit).listThreads({
      filter: { resourceId: getResourceId({ topicId: context.topic.id, userId: context.user.id }) },
      orderBy: { direction: "DESC", field: "updatedAt" },
      page: 0,
      perPage: false,
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to list topic conversations");
    }

    return result.value.threads.map(toSidebarThread);
  });

export const getOrCreateLatestConversation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const listed = await Kit.get(memoryKit).listThreads({
      filter: { resourceId: getResourceId({ topicId: undefined, userId: context.user.id }) },
      orderBy: { direction: "DESC", field: "updatedAt" },
      page: 0,
      perPage: 1,
    });

    if (Result.isError(listed)) {
      throw toServerFnError.serverError("Failed to list conversations");
    }

    const latest = listed.value.threads.at(0);

    if (latest) {
      return { created: false, id: latest.id };
    }

    const now = new Date();
    const created = await Kit.get(memoryKit).saveThread({
      thread: {
        id: nanoid(),
        resourceId: getResourceId({ topicId: undefined, userId: context.user.id }),
        title: "New conversation",
        createdAt: now,
        updatedAt: now,
      },
    });

    if (Result.isError(created)) {
      throw toServerFnError.serverError("Failed to create conversation");
    }

    return { created: true, id: created.value.id };
  });

export const sidebarQueries = {
  all: () => ["sidebar"] as const,
  topics: () =>
    queryOptions({
      queryKey: [...sidebarQueries.all(), "topics"] as const,
      queryFn: async () => listSidebarTopics(),
      staleTime: duration.FIVE.MINUTES,
    }),
  threads: (topicId: string | undefined) =>
    queryOptions({
      queryKey: [...sidebarQueries.all(), "threads", topicId] as const,
      queryFn: async () => {
        if (topicId) {
          return listSidebarTopicThreads({ data: { topicId } });
        }

        return listSidebarConversations();
      },
      placeholderData: keepPreviousData,
      staleTime: duration.FIVE.MINUTES,
    }),
};
