import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact, topic } from "@/db/schema";
import { artifactAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { getMemoryStore } from "@/mastra/memory";

import { threadKeys } from "./query-keys";

export const MENTIONS_QUERY_LIMIT = 20;

type MentionType = "artifact" | "thread" | "topic";

type MentionItem = {
  displayName: string;
  id: string;
  type: MentionType;
};

const buildArtifactMentionsWhereClause = (topicId: string, query: string) => {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return eq(artifact.topicId, topicId);
  }

  return and(
    eq(artifact.topicId, topicId),
    ilike(artifact.displayName, `%${trimmedQuery}%`)
  );
};

const buildTopicMentionsWhereClause = (userId: string, query: string) => {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return eq(topic.userId, userId);
  }

  return and(eq(topic.userId, userId), ilike(topic.title, `%${trimmedQuery}%`));
};

const titleMatchesQuery = (title: string, query: string) => {
  const trimmedQuery = query.trim().toLowerCase();

  return (
    trimmedQuery.length === 0 || title.toLowerCase().includes(trimmedQuery)
  );
};

const getMentionsInputSchema = v.object({
  resourceId: v.pipe(v.string(), v.nonEmpty()),
  query: v.optional(v.string(), ""),
});

export const getMentions = createServerFn({ method: "GET" })
  .inputValidator(getMentionsInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const ownedTopic = await db.query.topic.findFirst({
      columns: { id: true },
      where: {
        id: data.resourceId,
        userId: context.user.id,
      },
    });

    if (ownedTopic) {
      const memoryStore = await getMemoryStore();
      const [artifactMentions, threadsResult] = await Promise.all([
        db
          .select({
            id: artifact.id,
            displayName: artifact.displayName,
          })
          .from(artifact)
          .where(buildArtifactMentionsWhereClause(ownedTopic.id, data.query))
          .orderBy(desc(artifact.createdAt))
          .limit(MENTIONS_QUERY_LIMIT),
        memoryStore.listThreads({
          filter: { resourceId: ownedTopic.id },
          orderBy: { direction: "DESC", field: "updatedAt" },
          page: 0,
          perPage: false,
        }),
      ]);

      const mentions: MentionItem[] = artifactMentions.map((mention) => ({
        ...mention,
        type: "artifact",
      }));

      for (const thread of threadsResult.threads) {
        const title = thread.title ?? "";

        if (
          titleMatchesQuery(title, data.query) &&
          mentions.length < MENTIONS_QUERY_LIMIT
        ) {
          mentions.push({
            displayName: title,
            id: thread.id,
            type: "thread",
          });
        }
      }

      return mentions;
    }

    const topicMentions = await db
      .select({
        id: topic.id,
        displayName: topic.title,
      })
      .from(topic)
      .where(buildTopicMentionsWhereClause(context.user.id, data.query))
      .orderBy(desc(topic.updatedAt))
      .limit(MENTIONS_QUERY_LIMIT);

    return topicMentions.map(
      (mention): MentionItem => ({
        ...mention,
        type: "topic",
      })
    );
  });

export type MentionsQueryParams = {
  resourceId: string;
  query?: string;
};

export const mentionsQuery = ({
  resourceId,
  query = "",
}: MentionsQueryParams) =>
  queryOptions({
    queryKey: [...threadKeys.mentions(resourceId), { query }] as const,
    queryFn: async () =>
      getMentions({
        data: { query, resourceId },
      }),
    placeholderData: keepPreviousData,
  });

export const getMentionById = createServerFn({ method: "GET" })
  .middleware([artifactAccessMiddleware])
  .handler(async ({ context }) => {
    return {
      displayName: context.artifact.displayName,
      id: context.artifact.id,
      status: context.artifact.status,
    };
  });

type GetMentionByIdParams = {
  artifactId: string;
};

export const mentionByIdQuery = ({ artifactId }: GetMentionByIdParams) =>
  queryOptions({
    // without this the optimistic update for artifact upload might be discarded
    refetchOnMount: false,
    queryFn: async () =>
      getMentionById({
        data: { artifactId },
      }),
    queryKey: threadKeys.mention(artifactId),
  });
