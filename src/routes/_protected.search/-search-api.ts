import type { StorageThreadType } from "@mastra/core/memory";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
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
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import type { SafeId } from "@/lib/safe-id";
import { matchesQuery } from "@/lib/string-match";

const SEARCH_TOPIC_LIMIT = 100;
const SEARCH_THREAD_LIMIT = 5;
const SEARCH_TOPIC_THREAD_SCAN_LIMIT = 100;

const toConversationResult = (thread: StorageThreadType): SearchConversationResult => ({
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

type SearchCtx = Kits<[DbKit, MemoryKit]>;

export const searchItemsFn = Kit.gen(async function* (
  ctx: SearchCtx,
  { query, userId }: SearchItemsInput,
) {
  const hasQuery = query.length > 0;

  const [recentTopics, standaloneThreads] = yield* await Kit.promiseAll([
    ctx.db.run((db) =>
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
    ),
    ctx.memory.listThreads({
      filter: { resourceId: userId },
      orderBy: { direction: "DESC", field: "updatedAt" },
      page: 0,
      perPage: hasQuery ? SEARCH_TOPIC_THREAD_SCAN_LIMIT : SEARCH_THREAD_LIMIT,
    }),
  ]);

  const conversations = standaloneThreads.threads
    .filter((thread) => matchesQuery(thread.title ?? "", query))
    .slice(0, SEARCH_THREAD_LIMIT)
    .map((thread) => toConversationResult(thread));

  const topicThreadBatch = await Promise.all(
    recentTopics.map(async (recentTopic) =>
      ctx.memory.listThreads({
        filter: { resourceId: recentTopic.id },
        orderBy: { direction: "DESC", field: "updatedAt" },
        page: 0,
        perPage: hasQuery ? SEARCH_TOPIC_THREAD_SCAN_LIMIT : SEARCH_THREAD_LIMIT,
      }),
    ),
  );

  const topicResults: SearchTopicResult[] = [];

  for (const [index, recentTopic] of recentTopics.entries()) {
    const listed = yield* topicThreadBatch[index];
    const topicMatchesQuery = matchesQuery(recentTopic.title, query);

    const matchingThreads = topicMatchesQuery
      ? listed.threads
      : listed.threads.filter((thread) => matchesQuery(thread.title ?? "", query));

    if (hasQuery && !(topicMatchesQuery || matchingThreads.length > 0)) {
      continue;
    }

    topicResults.push({
      conversations: matchingThreads
        .slice(0, SEARCH_THREAD_LIMIT)
        .map((thread) => toConversationResult(thread))
        .sort((a, b) =>
          Temporal.Instant.compare(
            Temporal.Instant.from(b.updatedAt),
            Temporal.Instant.from(a.updatedAt),
          ),
        ),
      id: recentTopic.id,
      title: recentTopic.title,
      updatedAt: recentTopic.updatedAt.toISOString(),
    });
  }

  conversations.sort((a, b) =>
    Temporal.Instant.compare(
      Temporal.Instant.from(b.updatedAt),
      Temporal.Instant.from(a.updatedAt),
    ),
  );

  return Result.ok({
    conversations,
    topics: topicResults,
  });
});

const searchInputSchema = v.object({
  query: v.optional(v.string(), ""),
});

const searchCtx = Kit.createContext(dbKit, memoryKit);

export const searchItems = createServerFn({ method: "GET" })
  .validator(searchInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      searchItemsFn(searchCtx, {
        query: data.query.trim(),
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Database search failed"),
        MemoryError: () => toServerFnError.serverError("Memory search failed"),
      }),
    ),
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
