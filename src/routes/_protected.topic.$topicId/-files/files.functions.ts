import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { file } from "@/db/schema.server";
import type { FileStatus } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import {
  fileAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access.middleware";
import { s3Kit } from "@/lib/s3-kit.server";
import { vectorKit } from "@/lib/vector-kit.server";

import { deleteFileFn, listFilesFn, listPendingFilesFn } from "./files.server";

const filesCtx = Kit.createContext(dbKit);
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
  .handler(async ({ context }) =>
    Kit.run(async () =>
      listPendingFilesFn(filesCtx, { topicId: context.topic.id }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to list pending files")),
  );

const listFilesInputSchema = v.object({
  page: v.pipe(v.number(), v.integer(), v.minValue(1)),
  pageSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
  search: v.optional(
    v.pipe(
      v.string(),
      v.trim(),
      v.transform((value) => (value.length > 0 ? value : undefined)),
    ),
  ),
});

export const listFiles = createServerFn({ method: "GET" })
  .validator(listFilesInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      listFilesFn(filesCtx, {
        page: data.page,
        pageSize: data.pageSize,
        search: data.search,
        topicId: context.topic.id,
      }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to list files")),
  );

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
  byTopic: (topicId: string) => [...fileQueries.all(), "list", topicId] as const,
  list: ({ page, pageSize, search, topicId }: FilesQueryParams) =>
    queryOptions({
      queryFn: async () =>
        listFiles({
          data: { page, pageSize, search, topicId },
        }),
      queryKey: [...fileQueries.byTopic(topicId), { page, pageSize, search }] as const,
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
