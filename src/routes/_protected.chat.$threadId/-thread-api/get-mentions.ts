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
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";

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
  topicId: v.pipe(v.string(), v.nanoid()),
});

export const getMentions = createServerFn({ method: "GET" })
  .inputValidator(getMentionsInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ data }) => {
    return db
      .select({
        id: artifact.id,
        displayName: artifact.displayName,
        sha256: artifact.sha256,
        status: artifact.status,
      })
      .from(artifact)
      .where(buildMentionsWhereClause(data.topicId, data.query))
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

const getMentionByIdInputSchema = v.object({
  topicId: v.pipe(v.string(), v.nanoid()),
  artifactId: v.pipe(v.string(), v.nanoid()),
});

export const getMentionById = createServerFn({ method: "GET" })
  .inputValidator(getMentionByIdInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ data }) => {
    const mention = await db.query.artifact.findFirst({
      columns: {
        id: true,
        displayName: true,
        status: true,
      },
      where: {
        id: data.artifactId,
        topicId: data.topicId,
      },
    });

    return mention ?? null;
  });

type GetMentionByIdParams = {
  topicId?: string;
  artifactId: string;
};

export const mentionByIdQuery = ({
  topicId,
  artifactId,
}: GetMentionByIdParams) =>
  queryOptions({
    queryFn: topicId
      ? async () => {
          return getMentionById({
            data: { topicId, artifactId },
          });
        }
      : skipToken,
    queryKey: threadKeys.mention({ topicId: topicId ?? "", artifactId }),
  });
