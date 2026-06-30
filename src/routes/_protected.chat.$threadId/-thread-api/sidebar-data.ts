import type { StorageThreadType } from "@mastra/core/memory";
import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { topic } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { getAgentMemory, getMemoryStore } from "@/mastra/memory";
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

const deleteExpiredStandaloneConversations = async (userId: string) => {
  const memoryStore = await getMemoryStore();
  const { threads } = await memoryStore.listThreads({
    filter: { resourceId: userId },
    orderBy: { direction: "ASC", field: "updatedAt" },
    page: 0,
    perPage: false,
  });

  const expiresBefore = Date.now() - CONVERSATION_RETENTION_MS;

  const expiredThreads = threads.filter(
    (thread) => thread.updatedAt.getTime() < expiresBefore
  );

  if (expiredThreads.length === 0) {
    return;
  }

  const memory = await getAgentMemory("conversation-agent");
  await Promise.all(
    expiredThreads.map(async (thread) => memory.deleteThread(thread.id))
  );
};

const listTopicThreadPage = async (input: {
  topicId: string;
  page: number;
}) => {
  const memoryStore = await getMemoryStore();
  const result = await memoryStore.listThreads({
    filter: { resourceId: input.topicId },
    orderBy: { direction: "DESC", field: "updatedAt" },
    page: input.page,
    perPage: SIDEBAR_TOPIC_THREADS_PAGE_SIZE,
  });

  return {
    hasMore: result.hasMore,
    items: result.threads.map(toSidebarThread),
    nextPage: result.hasMore ? result.page + 1 : null,
  };
};

const paginationInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const listSidebarConversations = createServerFn({ method: "GET" })
  .inputValidator(paginationInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    await deleteExpiredStandaloneConversations(userId);

    const memoryStore = await getMemoryStore();
    const result = await memoryStore.listThreads({
      filter: { resourceId: userId },
      orderBy: { direction: "DESC", field: "updatedAt" },
      page: data.page,
      perPage: SIDEBAR_CONVERSATIONS_PAGE_SIZE,
    });

    return {
      hasMore: result.hasMore,
      items: result.threads.map(toSidebarThread),
      nextPage: result.hasMore ? result.page + 1 : null,
    };
  });

const topicsInputSchema = v.object({
  limit: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(SIDEBAR_INITIAL_TOPICS_LIMIT)
  ),
  offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const listSidebarTopics = createServerFn({ method: "GET" })
  .inputValidator(topicsInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const userTopicsWhere = eq(topic.userId, context.user.id);

    const [recentTopics, totalCount] = await Promise.all([
      db
        .select({
          id: topic.id,
          title: topic.title,
        })
        .from(topic)
        .where(userTopicsWhere)
        .orderBy(desc(topic.updatedAt))
        .limit(data.limit)
        .offset(data.offset),
      db.$count(topic, userTopicsWhere),
    ]);

    const items: SidebarTopic[] = await Promise.all(
      recentTopics.map(async (recentTopic) => {
        const threadsPage = await listTopicThreadPage({
          topicId: recentTopic.id,
          page: 0,
        });

        return {
          id: recentTopic.id,
          hasMoreThreads: threadsPage.hasMore,
          nextThreadsPage: threadsPage.nextPage,
          threads: threadsPage.items,
          title: recentTopic.title,
        };
      })
    );

    return {
      hasMore: data.offset + recentTopics.length < totalCount,
      items,
    };
  });

const topicThreadsInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(0)),
  topicId: v.pipe(v.string(), v.nanoid()),
});

export const listSidebarTopicThreads = createServerFn({ method: "GET" })
  .inputValidator(topicThreadsInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) =>
    listTopicThreadPage({ topicId: context.topic.id, page: data.page })
  );

export const sidebarConversationsQuery = () =>
  infiniteQueryOptions({
    queryKey: threadKeys.sidebarConversations(),
    queryFn: async ({ pageParam }) =>
      listSidebarConversations({ data: { page: pageParam } }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    placeholderData: keepPreviousData,
  });

const getSidebarTopicsPageRequest = (pageIndex: number) => {
  if (pageIndex === 0) {
    return {
      limit: SIDEBAR_INITIAL_TOPICS_LIMIT,
      offset: 0,
    };
  }

  return {
    limit: SIDEBAR_MORE_ITEMS_LIMIT,
    offset:
      SIDEBAR_INITIAL_TOPICS_LIMIT + (pageIndex - 1) * SIDEBAR_MORE_ITEMS_LIMIT,
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
      if (!lastPage.hasMore) {
        return undefined;
      }

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
