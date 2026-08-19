import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import * as v from "valibot";

import { file } from "@/db/schema.server";
import type { FileStatus } from "@/db/schema.server";
import { ilike } from "@/db/sql.server";
import { dbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import {
  fileAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access.middleware";
import { s3Kit } from "@/lib/s3-kit.server";
import { rawId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { vectorKit } from "@/lib/vector-kit.server";
import {
  FILE_PROCESSING_TTL_SECONDS,
  FILE_UPLOAD_TTL_SECONDS,
} from "@/routes/_protected.chat.$threadId/-thread-api/files.server";

import { deleteFileFn } from "./files.server";

const deleteFileCtx = Kit.createContext(dbKit, s3Kit, vectorKit);

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      deleteFileFn(deleteFileCtx, {
        fileId: context.file.id,
        s3Key: context.file.s3Key,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to delete file record"),
        S3Error: () => toServerFnError.serverError("Failed to delete file from S3"),
        VectorError: () => toServerFnError.serverError("Failed to delete file embedding"),
      }),
    ),
  );

const FILE_DOWNLOAD_URL_TTL_SECONDS = 3600;

export const getFileDownloadUrl = createServerFn({ method: "GET" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) => {
    if (context.file.status !== "ready") {
      throw toServerFnError.notFound();
    }

    const result = await Kit.get(s3Kit).getPresignedGetUrl({
      expiresIn: FILE_DOWNLOAD_URL_TTL_SECONDS,
      key: context.file.s3Key,
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(context.file.displayName)}`,
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to get file download URL");
    }

    return { url: result.value };
  });

export const getPendingFiles = createServerFn({ method: "GET" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const now = Temporal.Now.instant();
    const uploadCutoff = new Date(
      now.subtract({ seconds: FILE_UPLOAD_TTL_SECONDS }).epochMilliseconds,
    );
    const processingCutoff = new Date(
      now.subtract({ seconds: FILE_PROCESSING_TTL_SECONDS }).epochMilliseconds,
    );

    const result = await Kit.get(dbKit).run(async (db) => {
      await db
        .update(file)
        .set({ status: "failed" })
        .where(
          and(
            eq(file.topicId, context.topic.id),
            or(
              and(eq(file.status, "uploading"), lt(file.updatedAt, uploadCutoff)),
              and(eq(file.status, "processing"), lt(file.updatedAt, processingCutoff)),
            ),
          ),
        );

      return db
        .select({
          id: file.id,
        })
        .from(file)
        .where(
          and(
            eq(file.topicId, context.topic.id),
            inArray(file.status, ["uploading", "processing"]),
          ),
        );
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to list pending files");
    }

    return result.value.map((pendingFile) => ({
      id: rawId(pendingFile.id),
    }));
  });

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

  return and(eq(file.topicId, topicId), ilike(file.displayName, trimmedSearch));
};

export const listFiles = createServerFn({ method: "GET" })
  .validator(listFilesInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    const whereClause = buildWhereClause(context.topic.id, data.search);
    const offset = (data.page - 1) * data.pageSize;

    return Kit.run(async () =>
      Kit.get(dbKit).run(async (db) => {
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

        return { items, totalCount };
      }),
    ).throws(() => toServerFnError.serverError("Failed to list files"));
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

export const fileQueries = {
  all: () => ["file"] as const,
  lists: (topicId: string) => [...fileQueries.all(), "list", topicId] as const,
  list: ({ page, pageSize, search, topicId }: FilesQueryParams) =>
    queryOptions({
      queryFn: async () =>
        listFiles({
          data: { page, pageSize, search, topicId },
        }),
      queryKey: [...fileQueries.lists(topicId), { page, pageSize, search }] as const,
      placeholderData: keepPreviousData,
    }),
  pending: (topicId: string) =>
    queryOptions({
      queryFn: async () =>
        getPendingFiles({
          data: { topicId },
        }),
      queryKey: [...fileQueries.all(), "pending", topicId] as const,
    }),
};

const renameFileInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
});

export const renameFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .validator(renameFileInputSchema)
  .handler(async ({ context, data }) => {
    const result = await Kit.get(dbKit).run((db) =>
      db.update(file).set({ displayName: data.displayName }).where(eq(file.id, context.file.id)),
    );

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to rename file");
    }
  });
