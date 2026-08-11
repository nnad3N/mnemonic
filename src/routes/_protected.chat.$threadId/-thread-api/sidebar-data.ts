import type { StorageThreadType } from "@mastra/core/memory";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as v from "valibot";

import { topic } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import type { SafeId } from "@/lib/safe-id";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";

export type SidebarThread = {
  id: string;
  title: string;
  updatedAt: string;
};

const CONVERSATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const toSidebarThread = (thread: StorageThreadType): SidebarThread => ({
  id: thread.id,
  title: thread.title ?? "",
  updatedAt: thread.updatedAt.toISOString(),
});

const getExpiredThreads = (threads: StorageThreadType[]) => {
  const expiresBefore = Temporal.Now.instant().subtract({
    milliseconds: CONVERSATION_RETENTION_MS,
  });

  return threads.filter(
    (thread) => Temporal.Instant.compare(thread.updatedAt.toTemporalInstant(), expiresBefore) < 0,
  );
};

type SidebarCtx = Kits<[DbKit, MemoryKit]>;

type ListSidebarConversationsInput = {
  userId: SafeId<"user">;
};

export const listSidebarConversationsFn = Kit.gen(async function* (
  ctx: SidebarCtx,
  input: ListSidebarConversationsInput,
) {
  const oldestThreads = yield* await ctx.memory.listThreads({
    filter: { resourceId: input.userId },
    orderBy: { direction: "ASC", field: "updatedAt" },
    page: 0,
    perPage: false,
  });

  const expiredThreads = getExpiredThreads(oldestThreads.threads);
  yield* await Kit.promiseAll(
    expiredThreads.map(async (thread) =>
      ctx.memory.deleteAgentThread({
        agentId: "conversation-agent",
        threadId: thread.id,
      }),
    ),
  );

  const conversations = yield* await ctx.memory.listThreads({
    filter: { resourceId: input.userId },
    orderBy: { direction: "DESC", field: "updatedAt" },
    page: 0,
    perPage: false,
  });

  return Result.ok(conversations.threads.map(toSidebarThread));
});

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
      filter: { resourceId: context.topic.id },
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
      filter: { resourceId: context.user.id },
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
        resourceId: context.user.id,
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

export const sidebarTopicsQuery = () =>
  queryOptions({
    queryKey: threadKeys.sidebarTopics(),
    queryFn: async () => listSidebarTopics(),
  });

export const sidebarThreadsQuery = (topicId: string | undefined) =>
  queryOptions({
    queryKey: threadKeys.sidebarThreads(topicId),
    queryFn: async () => {
      if (topicId) {
        return listSidebarTopicThreads({ data: { topicId } });
      }

      return listSidebarConversations();
    },
    placeholderData: keepPreviousData,
  });
