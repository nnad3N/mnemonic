import type { StorageThreadType } from "@mastra/core/memory";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { desc, eq } from "drizzle-orm";
import * as v from "valibot";

import { topic } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { Kit, mergeKits, ServerFnError } from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import type { SafeId } from "@/lib/safe-id";

const SEARCH_TOPIC_LIMIT = 100;
const SEARCH_THREAD_LIMIT = 5;
const SEARCH_TOPIC_THREAD_SCAN_LIMIT = 100;

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

type SearchItemsInput = {
  query: string;
  userId: SafeId<"user">;
};

type SearchKit = Kits<[DbKit, MemoryKit]>;

const searchItemsFn = Kit.gen(async function* (
  ctx: SearchKit,
  { query, userId }: SearchItemsInput
) {
  const hasQuery = query.length > 0;

  const [recentTopicsResult, standaloneThreadsResult] = await Promise.all([
    ctx.db((db) =>
      db
        .select({
          id: topic.id,
          title: topic.title,
          updatedAt: topic.updatedAt,
        })
        .from(topic)
        .where(eq(topic.userId, userId))
        .orderBy(desc(topic.updatedAt))
        .limit(SEARCH_TOPIC_LIMIT)
    ),
    ctx.memory(async (memory) =>
      memory.listThreads({
        filter: { resourceId: userId },
        orderBy: { direction: "DESC", field: "updatedAt" },
        page: 0,
        perPage: hasQuery
          ? SEARCH_TOPIC_THREAD_SCAN_LIMIT
          : SEARCH_THREAD_LIMIT,
      })
    ),
  ]);

  const recentTopics = yield* recentTopicsResult;
  const standaloneThreads = yield* standaloneThreadsResult;

  const conversations = standaloneThreads.threads
    .filter((thread) => titleMatchesQuery(thread.title ?? "", query))
    .slice(0, SEARCH_THREAD_LIMIT)
    .map((thread) => toConversationResult(thread));

  const topicThreadResults = yield* await ctx.memory(async (memory) =>
    Promise.all(
      recentTopics.map(async (recentTopic) =>
        memory.listThreads({
          filter: { resourceId: recentTopic.id },
          orderBy: { direction: "DESC", field: "updatedAt" },
          page: 0,
          perPage: hasQuery
            ? SEARCH_TOPIC_THREAD_SCAN_LIMIT
            : SEARCH_THREAD_LIMIT,
        })
      )
    )
  );

  const topicResults: SearchTopicResult[] = [];

  for (const [index, recentTopic] of recentTopics.entries()) {
    const result = topicThreadResults[index];
    const topicMatchesQuery = titleMatchesQuery(recentTopic.title, query);

    const matchingThreads = topicMatchesQuery
      ? result.threads
      : result.threads.filter((thread) =>
          titleMatchesQuery(thread.title ?? "", query)
        );

    if (hasQuery && !(topicMatchesQuery || matchingThreads.length > 0)) {
      continue;
    }

    topicResults.push({
      conversations: matchingThreads
        .slice(0, SEARCH_THREAD_LIMIT)
        .map((thread) => toConversationResult(thread)),
      id: recentTopic.id,
      title: recentTopic.title,
      updatedAt: recentTopic.updatedAt.toISOString(),
    });
  }

  conversations.sort(
    (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
  );

  return Result.ok({
    conversations,
    topics: topicResults,
  });
});

const searchInputSchema = v.object({
  query: v.optional(v.string(), ""),
});

const searchKit = mergeKits(dbKit, memoryKit);

export const searchItems = createServerFn({ method: "GET" })
  .inputValidator(searchInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.serverFn(searchItemsFn, {
      DatabaseError: () =>
        new ServerFnError({
          message: "Something went wrong",
          status: "server-error",
        }),
      MemoryError: () =>
        new ServerFnError({
          message: "Something went wrong",
          status: "server-error",
        }),
    })(searchKit, {
      query: data.query.trim(),
      userId: context.user.id,
    })
  );

export type SearchQueryInput = {
  query: string;
};

export const searchQuery = ({ query }: SearchQueryInput) =>
  queryOptions({
    queryFn: async () =>
      searchItems({
        data: { query },
      }),
    queryKey: ["search", { query }] as const,
    placeholderData: keepPreviousData,
  });
