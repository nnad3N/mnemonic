import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import type { ArtifactStatus } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";

const listArtifactsInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(1)),
  pageSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  search: v.optional(v.string(), ""),
  topicId: v.pipe(v.string(), v.nanoid()),
});

const buildWhereClause = (topicId: string, search: string) => {
  const trimmedSearch = search.trim();

  if (trimmedSearch.length === 0) {
    return eq(artifact.topicId, topicId);
  }

  return and(
    eq(artifact.topicId, topicId),
    ilike(artifact.displayName, `%${trimmedSearch}%`)
  );
};

export const listArtifacts = createServerFn({ method: "GET" })
  .inputValidator(listArtifactsInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ data }) => {
    const whereClause = buildWhereClause(data.topicId, data.search);
    const offset = (data.page - 1) * data.pageSize;

    const [items, totalCount] = await Promise.all([
      db
        .select({
          createdAt: artifact.createdAt,
          displayName: artifact.displayName,
          id: artifact.id,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.sizeBytes,
          status: artifact.status,
        })
        .from(artifact)
        .where(whereClause)
        .orderBy(desc(artifact.createdAt))
        .limit(data.pageSize)
        .offset(offset),
      db.$count(artifact, whereClause),
    ]);

    return {
      items,
      totalCount,
    };
  });

export type ArtifactItem = {
  createdAt: Date;
  displayName: string;
  id: string;
  mimeType: string;
  sizeBytes: number;
  status: ArtifactStatus;
};

export type ListArtifactsResult = {
  items: ArtifactItem[];
  totalCount: number;
};

export type ArtifactsQueryParams = {
  page: number;
  pageSize: number;
  search: string;
  topicId: string;
};

export const artifactsQuery = ({
  page,
  pageSize,
  search,
  topicId,
}: ArtifactsQueryParams) =>
  queryOptions({
    queryFn: async () =>
      listArtifacts({
        data: { page, pageSize, search, topicId },
      }),
    queryKey: [...threadKeys.artifacts(topicId), { page, pageSize, search }],
    placeholderData: keepPreviousData,
  });
