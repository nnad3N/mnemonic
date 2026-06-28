import {
  keepPreviousData,
  queryOptions,
  skipToken,
} from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import {
  artifactAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";

import { threadKeys } from "./query-keys";

export const MENTIONS_QUERY_LIMIT = 20;

const buildMentionsWhereClause = (topicId: string, query: string) => {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return eq(artifact.topicId, topicId);
  }

  return and(
    eq(artifact.topicId, topicId),
    ilike(artifact.displayName, `%${trimmedQuery}%`)
  );
};

const getMentionsInputSchema = v.object({
  query: v.optional(v.string(), ""),
});

export const getMentions = createServerFn({ method: "GET" })
  .inputValidator(getMentionsInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    return db
      .select({
        id: artifact.id,
        displayName: artifact.displayName,
        sha256: artifact.sha256,
        status: artifact.status,
      })
      .from(artifact)
      .where(buildMentionsWhereClause(context.topic.id, data.query))
      .orderBy(desc(artifact.createdAt))
      .limit(MENTIONS_QUERY_LIMIT);
  });

export type MentionsQueryParams = {
  topicId?: string;
  query?: string;
};

export const mentionsQuery = ({ topicId, query = "" }: MentionsQueryParams) =>
  queryOptions({
    queryKey: [...threadKeys.mentions(topicId ?? ""), { query }] as const,
    queryFn: topicId
      ? async () => {
          return getMentions({
            data: { query, topicId },
          });
        }
      : skipToken,
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
