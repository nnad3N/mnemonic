import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { resource } from "@/db/schema";
import type { ResourceStatus } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

const listResourcesInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(1)),
  pageSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  search: v.optional(v.string(), ""),
});

const buildWhereClause = (topicId: string, search: string) => {
  const trimmedSearch = search.trim();

  if (trimmedSearch.length === 0) {
    return eq(resource.topicId, topicId);
  }

  return and(
    eq(resource.topicId, topicId),
    ilike(resource.displayName, `%${trimmedSearch}%`)
  );
};

export const listResources = createServerFn({ method: "GET" })
  .inputValidator(listResourcesInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    const whereClause = buildWhereClause(context.topic.id, data.search);
    const offset = (data.page - 1) * data.pageSize;

    const [items, totalCount] = await Promise.all([
      db
        .select({
          createdAt: resource.createdAt,
          displayName: resource.displayName,
          id: resource.id,
          mimeType: resource.mimeType,
          sizeBytes: resource.sizeBytes,
          status: resource.status,
        })
        .from(resource)
        .where(whereClause)
        .orderBy(desc(resource.createdAt))
        .limit(data.pageSize)
        .offset(offset),
      db.$count(resource, whereClause),
    ]);

    return {
      items,
      totalCount,
    };
  });

export type ResourceItem = {
  createdAt: Date;
  displayName: string;
  id: string;
  mimeType: string;
  sizeBytes: number;
  status: ResourceStatus;
};

export type ListResourcesResult = {
  items: ResourceItem[];
  totalCount: number;
};

export type ResourcesQueryParams = {
  page: number;
  pageSize: number;
  search: string;
  topicId: string;
};

export const resourcesQuery = ({
  page,
  pageSize,
  search,
  topicId,
}: ResourcesQueryParams) =>
  queryOptions({
    queryFn: async () =>
      listResources({
        data: { page, pageSize, search, topicId },
      }),
    queryKey: [...topicKeys.resources(topicId), { page, pageSize, search }],
    placeholderData: keepPreviousData,
  });
