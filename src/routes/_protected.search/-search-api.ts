import type { StorageThreadType } from "@mastra/core/memory";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { topic } from "@/db/schema";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { getMemoryStore } from "@/mastra/memory";

const SEARCH_TOPIC_LIMIT = 100;
const SEARCH_THREAD_LIMIT = 5;
const SEARCH_TOPIC_THREAD_SCAN_LIMIT = 100;

const searchInputSchema = v.object({
  query: v.optional(v.string(), ""),
});

export type SearchConversationResult = {
  id: string;
  title: string;
  updatedAt: string;
};

export type SearchTopicResult = {
  conversations: SearchConversationResult[];
  id: string;
  title: string;
  updatedAt: string;
};

const titleMatchesQuery = (title: string, query: string) => {
  const trimmedQuery = query.trim().toLowerCase();

  return (
    trimmedQuery.length === 0 || title.toLowerCase().includes(trimmedQuery)
  );
};

const toConversationResult = (
  thread: StorageThreadType
): SearchConversationResult => ({
  id: thread.id,
  title: thread.title ?? "",
  updatedAt: thread.updatedAt.toISOString(),
});

const byUpdatedAtDesc = (
  first: SearchConversationResult,
  second: SearchConversationResult
) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt);

export const searchItems = createServerFn({ method: "GET" })
  .inputValidator(searchInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const userId = context.user.id;
    const query = data.query.trim();
    const memoryStore = await getMemoryStore();
    const hasQuery = query.length > 0;

    const [recentTopics, standaloneThreads] = await Promise.all([
      db
        .select({
          id: topic.id,
          title: topic.title,
          updatedAt: topic.updatedAt,
        })
        .from(topic)
        .where(eq(topic.userId, userId))
        .orderBy(desc(topic.updatedAt))
        .limit(SEARCH_TOPIC_LIMIT),
      memoryStore.listThreads({
        filter: { resourceId: userId },
        orderBy: { direction: "DESC", field: "updatedAt" },
        page: 0,
        perPage: hasQuery
          ? SEARCH_TOPIC_THREAD_SCAN_LIMIT
          : SEARCH_THREAD_LIMIT,
      }),
    ]);

    const conversations = standaloneThreads.threads
      .filter((thread) => titleMatchesQuery(thread.title ?? "", query))
      .slice(0, SEARCH_THREAD_LIMIT)
      .map((thread) => toConversationResult(thread));

    const topicResults = await Promise.all(
      recentTopics.map(async (recentTopic) => {
        const topicMatchesQuery = titleMatchesQuery(recentTopic.title, query);
        const result = await memoryStore.listThreads({
          filter: { resourceId: recentTopic.id },
          orderBy: { direction: "DESC", field: "updatedAt" },
          page: 0,
          perPage: hasQuery
            ? SEARCH_TOPIC_THREAD_SCAN_LIMIT
            : SEARCH_THREAD_LIMIT,
        });

        const matchingThreads = topicMatchesQuery
          ? result.threads
          : result.threads.filter((thread) =>
              titleMatchesQuery(thread.title ?? "", query)
            );

        if (hasQuery && !(topicMatchesQuery || matchingThreads.length > 0)) {
          return null;
        }

        return {
          conversations: matchingThreads
            .slice(0, SEARCH_THREAD_LIMIT)
            .map((thread) => toConversationResult(thread)),
          id: recentTopic.id,
          title: recentTopic.title,
          updatedAt: recentTopic.updatedAt.toISOString(),
        } satisfies SearchTopicResult;
      })
    );

    conversations.sort(byUpdatedAtDesc);

    return {
      conversations,
      topics: topicResults.filter((topicResult) => topicResult !== null),
    };
  });

export type SearchQueryParams = {
  query: string;
};

export const searchQuery = ({ query }: SearchQueryParams) =>
  queryOptions({
    queryFn: async () =>
      searchItems({
        data: { query },
      }),
    queryKey: ["search", { query }] as const,
    placeholderData: keepPreviousData,
  });
