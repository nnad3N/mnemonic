import type { StorageThreadType } from "@mastra/core/memory";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { topic } from "@/db/schema";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { getMemoryStore } from "@/mastra/memory";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread.api/query-keys";
import type {
  SidebarThread,
  SidebarTopic,
} from "@/routes/_protected.chat.$threadId/-thread.api/types";

const CONVERSATIONS_LIMIT = 5;
const TOPICS_LIMIT = 5;
const TOPIC_THREADS_LIMIT = 5;

const toSidebarThread = (thread: StorageThreadType): SidebarThread => ({
  id: thread.id,
  title: thread.title ?? "",
  updatedAt: thread.updatedAt.toISOString(),
});

export const listSidebarData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const memoryStore = await getMemoryStore();
    const userId = context.user.id;

    const [conversationThreadsResult, recentTopics] = await Promise.all([
      memoryStore.listThreads({
        filter: { resourceId: userId },
        orderBy: { direction: "DESC", field: "updatedAt" },
        page: 0,
        perPage: CONVERSATIONS_LIMIT,
      }),
      db
        .select({
          id: topic.id,
          title: topic.title,
        })
        .from(topic)
        .where(eq(topic.userId, userId))
        .orderBy(desc(topic.updatedAt))
        .limit(TOPICS_LIMIT),
    ]);

    const topicThreadGroups = await Promise.all(
      recentTopics.map(async (recentTopic) => {
        const { threads } = await memoryStore.listThreads({
          filter: { resourceId: recentTopic.id },
          orderBy: { direction: "DESC", field: "updatedAt" },
          page: 0,
          perPage: TOPIC_THREADS_LIMIT,
        });

        return {
          ...recentTopic,
          threads,
        };
      })
    );

    const topics: SidebarTopic[] = [];

    for (const topicGroup of topicThreadGroups) {
      if (topicGroup.threads.length === 0) {
        continue;
      }

      topics.push({
        id: topicGroup.id,
        title: topicGroup.title,
        threads: topicGroup.threads.map(toSidebarThread),
      });
    }

    return {
      conversations: conversationThreadsResult.threads.map(toSidebarThread),
      topics,
    };
  });

export const sidebarDataQuery = queryOptions({
  queryFn: listSidebarData,
  queryKey: threadKeys.sidebar(),
});
