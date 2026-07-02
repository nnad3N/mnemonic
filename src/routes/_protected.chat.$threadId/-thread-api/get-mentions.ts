import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { file, topic } from "@/db/schema";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import type { SafeId } from "@/lib/safe-id";
import { rawId, toSafeId } from "@/lib/safe-id";
import { getMemoryStore } from "@/mastra/memory";

import type { MentionQueryType } from "./query-keys";
import { threadKeys } from "./query-keys";

export const MENTIONS_QUERY_LIMIT = 20;

type MentionItem = {
  displayName: string;
  id: string;
  type: MentionQueryType;
};

const buildFileMentionsWhereClause = (
  topicId: SafeId<"topic">,
  query: string
) => {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return eq(file.topicId, topicId);
  }

  return and(
    eq(file.topicId, topicId),
    ilike(file.displayName, `%${trimmedQuery}%`)
  );
};

const buildTopicMentionsWhereClause = (
  userId: SafeId<"user">,
  query: string
) => {
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
  type: v.picklist(["file", "thread", "topic"]),
});

export const getMentions = createServerFn({ method: "GET" })
  .inputValidator(getMentionsInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const ownedTopic = await db.query.topic.findFirst({
      columns: { id: true },
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"topic">(data.resourceId),
        userId: context.user.id,
      },
    });

    if (ownedTopic) {
      const memoryStore = await getMemoryStore();
      const [fileMentions, threadsResult] = await Promise.all([
        db
          .select({
            id: file.id,
            displayName: file.displayName,
          })
          .from(file)
          .where(buildFileMentionsWhereClause(ownedTopic.id, data.query))
          .orderBy(desc(file.createdAt))
          .limit(MENTIONS_QUERY_LIMIT),
        memoryStore.listThreads({
          filter: { resourceId: ownedTopic.id },
          orderBy: { direction: "DESC", field: "updatedAt" },
          page: 0,
          perPage: false,
        }),
      ]);

      const mentions: MentionItem[] = fileMentions.map((mention) => ({
        ...mention,
        type: "file",
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
      case "file": {
        const ownedFile = await db.query.file.findFirst({
          columns: {
            displayName: true,
            id: true,
            status: true,
          },
          where: {
            // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
            id: toSafeId<"file">(data.id),
            userId: context.user.id,
          },
        });

        return ownedFile
          ? {
              displayName: ownedFile.displayName,
              id: rawId(ownedFile.id),
              status: ownedFile.status,
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
            // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
            id: toSafeId<"topic">(data.id),
            userId: context.user.id,
          },
        });

        return ownedTopic
          ? {
              displayName: ownedTopic.title,
              id: rawId(ownedTopic.id),
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
              // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
              id: toSafeId<"topic">(thread.resourceId),
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
    // without this the optimistic update for file upload might be discarded
    refetchOnMount: false,
    queryFn: async () =>
      getMentionById({
        data: { id, type },
      }),
    queryKey: threadKeys.mention(type, id),
  });
