import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ilike } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { file } from "@/db/schema";
import type { FileStatus } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import type { SafeId } from "@/lib/safe-id";
import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

const listFilesInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(1)),
  pageSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  search: v.optional(v.string(), ""),
});

const buildWhereClause = (topicId: SafeId<"topic">, search: string) => {
  const trimmedSearch = search.trim();

  if (trimmedSearch.length === 0) {
    return eq(file.topicId, topicId);
  }

  return and(
    eq(file.topicId, topicId),
    ilike(file.displayName, `%${trimmedSearch}%`)
  );
};

export const listFiles = createServerFn({ method: "GET" })
  .inputValidator(listFilesInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    const whereClause = buildWhereClause(context.topic.id, data.search);
    const offset = (data.page - 1) * data.pageSize;

    const [items, totalCount] = await Promise.all([
      db
        .select({
          createdAt: file.createdAt,
          displayName: file.displayName,
          id: file.id,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          status: file.status,
        })
        .from(file)
        .where(whereClause)
        .orderBy(desc(file.createdAt))
        .limit(data.pageSize)
        .offset(offset),
      db.$count(file, whereClause),
    ]);

    return {
      items,
      totalCount,
    };
  });

export type FileItem = {
  createdAt: Date;
  displayName: string;
  id: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
};

export type ListFilesResult = {
  items: FileItem[];
  totalCount: number;
};

export type FilesQueryParams = {
  page: number;
  pageSize: number;
  search: string;
  topicId: string;
};

export const filesQuery = ({
  page,
  pageSize,
  search,
  topicId,
}: FilesQueryParams) =>
  queryOptions({
    queryFn: async () =>
      listFiles({
        data: { page, pageSize, search, topicId },
      }),
    queryKey: [...topicKeys.files(topicId), { page, pageSize, search }],
    placeholderData: keepPreviousData,
  });
