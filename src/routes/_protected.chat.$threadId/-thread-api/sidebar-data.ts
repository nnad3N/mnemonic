import type { StorageThreadType } from "@mastra/core/memory";
import type { StorageListThreadsOutput } from "@mastra/core/storage";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { desc, eq } from "drizzle-orm";
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
import type {
  SidebarThread,
  SidebarTopic,
} from "@/routes/_protected.chat.$threadId/-thread-api/types";

const SIDEBAR_CONVERSATIONS_PAGE_SIZE = 5;
const SIDEBAR_INITIAL_TOPICS_LIMIT = 50;
const SIDEBAR_MORE_ITEMS_LIMIT = 10;
const SIDEBAR_TOPIC_THREADS_PAGE_SIZE = 10;

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
    (thread) =>
      Temporal.Instant.compare(
        Temporal.Instant.fromEpochMilliseconds(thread.updatedAt.getTime()),
        expiresBefore,
      ) < 0,
  );
};

const toTopicThreadsPage = (result: StorageListThreadsOutput) => ({
  hasMore: result.hasMore,
  items: result.threads.map(toSidebarThread),
  nextPage: result.hasMore ? result.page + 1 : null,
});

type SidebarCtx = Kits<[DbKit, MemoryKit]>;

type ListSidebarConversationsInput = {
  page: number;
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
    page: input.page,
    perPage: SIDEBAR_CONVERSATIONS_PAGE_SIZE,
  });

  return Result.ok(toTopicThreadsPage(conversations));
});

type ListSidebarTopicsInput = {
  limit: number;
  offset: number;
  userId: SafeId<"user">;
};

export const listSidebarTopicsFn = Kit.gen(async function* (
  ctx: SidebarCtx,
  input: ListSidebarTopicsInput,
) {
  const { recentTopics, totalCount } = yield* await ctx.db.run(async (db) => {
    const userTopicsWhere = eq(topic.userId, input.userId);
    const [recentTopics, totalCount] = await Promise.all([
      db
        .select({
          id: topic.id,
          title: topic.title,
        })
        .from(topic)
        .where(userTopicsWhere)
        .orderBy(desc(topic.updatedAt))
        .limit(input.limit)
        .offset(input.offset),
      db.$count(topic, userTopicsWhere),
    ]);

    return { recentTopics, totalCount };
  });

  const threadResults = await Promise.all(
    recentTopics.map(async (recentTopic) =>
      ctx.memory.listThreads({
        filter: { resourceId: recentTopic.id },
        orderBy: { direction: "DESC", field: "updatedAt" },
        page: 0,
        perPage: SIDEBAR_TOPIC_THREADS_PAGE_SIZE,
      }),
    ),
  );

  const items: SidebarTopic[] = [];

  for (const [index, recentTopic] of recentTopics.entries()) {
    const threads = yield* threadResults[index];
    const threadsPage = toTopicThreadsPage(threads);

    items.push({
      id: recentTopic.id,
      hasMoreThreads: threadsPage.hasMore,
      nextThreadsPage: threadsPage.nextPage,
      threads: threadsPage.items,
      title: recentTopic.title,
    });
  }

  return Result.ok({
    hasMore: input.offset + recentTopics.length < totalCount,
    items,
  });
});

const sidebarCtx = Kit.createContext(dbKit, memoryKit);

const paginationInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const listSidebarConversations = createServerFn({ method: "GET" })
  .validator(paginationInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      listSidebarConversationsFn(sidebarCtx, {
        page: data.page,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        MemoryError: () => toServerFnError.serverError("Failed to list conversations"),
      }),
    ),
  );

const topicsInputSchema = v.object({
  limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(SIDEBAR_INITIAL_TOPICS_LIMIT)),
  offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const listSidebarTopics = createServerFn({ method: "GET" })
  .validator(topicsInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      listSidebarTopicsFn(sidebarCtx, {
        limit: data.limit,
        offset: data.offset,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to list topics"),
        MemoryError: () => toServerFnError.serverError("Failed to list topic conversations"),
      }),
    ),
  );

const topicThreadsInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(0)),
  topicId: v.pipe(v.string(), v.nanoid()),
});

export const listSidebarTopicThreads = createServerFn({ method: "GET" })
  .validator(topicThreadsInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    const result = await Kit.get(memoryKit).listThreads({
      filter: { resourceId: context.topic.id },
      orderBy: { direction: "DESC", field: "updatedAt" },
      page: data.page,
      perPage: SIDEBAR_TOPIC_THREADS_PAGE_SIZE,
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to list topic conversations");
    }

    return toTopicThreadsPage(result.value);
  });

export const sidebarConversationsQuery = () =>
  infiniteQueryOptions({
    queryKey: threadKeys.sidebarConversations(),
    queryFn: async ({ pageParam }) => listSidebarConversations({ data: { page: pageParam } }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    placeholderData: keepPreviousData,
  });

export const getSidebarTopicsPageRequest = (pageIndex: number) => {
  if (pageIndex === 0) {
    return {
      limit: SIDEBAR_INITIAL_TOPICS_LIMIT,
      offset: 0,
    };
  }

  return {
    limit: SIDEBAR_MORE_ITEMS_LIMIT,
    offset: SIDEBAR_INITIAL_TOPICS_LIMIT + (pageIndex - 1) * SIDEBAR_MORE_ITEMS_LIMIT,
  };
};

export const sidebarTopicsQuery = () =>
  infiniteQueryOptions({
    queryKey: threadKeys.sidebarTopics(),
    queryFn: async ({ pageParam }) =>
      listSidebarTopics({
        data: getSidebarTopicsPageRequest(pageParam),
      }),
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      if (!lastPage.hasMore) return;

      return lastPageParam + 1;
    },
    initialPageParam: 0,
    placeholderData: keepPreviousData,
  });

export const sidebarTopicThreadsQuery = (topicId: string) =>
  infiniteQueryOptions({
    queryKey: threadKeys.sidebarTopicThreads(topicId),
    queryFn: async ({ pageParam }) =>
      listSidebarTopicThreads({
        data: {
          page: pageParam,
          topicId,
        },
      }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
