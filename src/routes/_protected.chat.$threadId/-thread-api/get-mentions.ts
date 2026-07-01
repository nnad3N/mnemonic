import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact, topic } from "@/db/schema";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { getMemoryStore } from "@/mastra/memory";

import type { MentionQueryType } from "./query-keys";
import { threadKeys } from "./query-keys";

export const MENTIONS_QUERY_LIMIT = 20;

type MentionItem = {
  displayName: string;
  id: string;
  type: MentionQueryType;
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

const getMentionByIdInputSchema = v.object({
  id: v.pipe(v.string(), v.nanoid()),
  type: v.picklist(["artifact", "thread", "topic"]),
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
  .inputValidator(getMentionByIdInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    switch (data.type) {
      case "artifact": {
        const ownedArtifact = await db.query.artifact.findFirst({
          columns: {
            displayName: true,
            id: true,
            status: true,
          },
          where: {
            id: data.id,
            userId: context.user.id,
          },
        });

        return ownedArtifact
          ? {
              displayName: ownedArtifact.displayName,
              id: ownedArtifact.id,
              status: ownedArtifact.status,
            }
          : null;
      }
      case "topic": {
        const ownedTopic = await db.query.topic.findFirst({
          columns: {
            id: true,
            title: true,
          },
          where: {
            id: data.id,
            userId: context.user.id,
          },
        });

        return ownedTopic
          ? {
              displayName: ownedTopic.title,
              id: ownedTopic.id,
              status: "ready" as const,
            }
          : null;
      }
      case "thread": {
        const memoryStore = await getMemoryStore();
        const thread = await memoryStore.getThreadById({ threadId: data.id });

        if (thread === null) {
          return null;
        }

        if (thread.resourceId !== context.user.id) {
          const ownedTopic = await db.query.topic.findFirst({
            columns: { id: true },
            where: {
              id: thread.resourceId,
              userId: context.user.id,
            },
          });

          if (!ownedTopic) {
            return null;
          }
        }

        return {
          displayName: thread.title ?? "",
          id: thread.id,
          status: "ready" as const,
        };
      }
      default: {
        return null;
      }
    }
  });

type GetMentionByIdParams = {
  id: string;
  type: MentionQueryType;
};

export const mentionByIdQuery = ({ id, type }: GetMentionByIdParams) =>
  queryOptions({
    // without this the optimistic update for artifact upload might be discarded
    refetchOnMount: false,
    queryFn: async () =>
      getMentionById({
        data: { id, type },
      }),
    queryKey: threadKeys.mention(type, id),
  });
