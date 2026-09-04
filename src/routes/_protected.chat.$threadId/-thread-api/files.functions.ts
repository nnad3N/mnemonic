import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { and, eq, inArray } from "drizzle-orm";
import * as v from "valibot";

import { file } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import type { DatabaseError } from "@/lib/db-kit.server";
import { FileUploadError } from "@/lib/errors/file-upload-error";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import {
  fileAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access.middleware";
import { s3Kit } from "@/lib/s3-kit.server";
import { mastra } from "@/mastra/instance.server";

import { getPresignedUrlFn, processFileFn, retryFileFn } from "./files.server";
import { processFileWorkflow } from "./upload-file-workflow.server";

const getPresignedUrlInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
  fileId: v.pipe(v.string(), v.nanoid()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  sha256: v.pipe(v.string(), v.length(64)),
  sizeBytes: v.pipe(v.number(), v.minValue(1)),
});

const uploadFileCtx = Kit.createContext(dbKit, s3Kit);

export const getPresignedUrl = createServerFn({ method: "POST" })
  .validator(getPresignedUrlInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      getPresignedUrlFn(uploadFileCtx, {
        displayName: data.displayName,
        fileId: data.fileId,
        mimeType: data.mimeType,
        topicId: context.topic.id,
        sha256: data.sha256,
        sizeBytes: data.sizeBytes,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to prepare file upload"),
        FileUploadError: (fileUploadError) => toServerFnError.serverError(fileUploadError.message),
        S3Error: () => toServerFnError.serverError("Failed to prepare file upload"),
      }),
    ),
  );

const processFileCtx = Kit.createContext(dbKit);

const toProcessFileError = (error: DatabaseError | ServerFnError) =>
  matchError(error, {
    DatabaseError: () => toServerFnError.serverError("Failed to update the file status"),
    ServerFnError: (error) => error,
  });

export const processFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      processFileFn(processFileCtx, {
        fileId: context.file.id,
        topicId: context.topicId,
        userId: context.user.id,
        workflow: mastra.getWorkflow(processFileWorkflow.id),
      }),
    ).throws<ServerFnError>(toProcessFileError),
  );

export const retryFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      retryFileFn(processFileCtx, {
        fileId: context.file.id,
        status: context.file.status,
        topicId: context.topicId,
        userId: context.user.id,
        workflow: mastra.getWorkflow(processFileWorkflow.id),
      }),
    ).throws<ServerFnError>(toProcessFileError),
  );

const findFilesBySha256InputSchema = v.object({
  sha256s: v.array(v.pipe(v.string(), v.nonEmpty())),
});

export const findFilesBySha256 = createServerFn({ method: "GET" })
  .validator(findFilesBySha256InputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      Kit.get(dbKit).run((db) =>
        db
          .select({
            id: file.id,
            sha256: file.sha256,
            status: file.status,
          })
          .from(file)
          .where(and(eq(file.topicId, context.topic.id), inArray(file.sha256, data.sha256s))),
      ),
    ).throws(() => toServerFnError.serverError("Failed to find matching files")),
  );

export type UploadFileVars = {
  topicId: string;
  file: File;
  fileId: string;
  sha256: string;
};

export const fileMutations = {
  all: () => ["file-mutation"] as const,
  upload: (threadId: string) =>
    mutationOptions({
      retry: 3,
      mutationKey: [...fileMutations.all(), "upload", threadId] as const,
      mutationFn: async ({ file, fileId, sha256, topicId }: UploadFileVars) => {
        const presigned = await getPresignedUrl({
          data: {
            displayName: file.name,
            fileId,
            mimeType: file.type,
            sha256,
            sizeBytes: file.size,
            topicId,
          },
        });

        if (presigned.type === "skipped") {
          return { fileId };
        }

        const uploadResult = await Result.tryPromise(async () =>
          fetch(presigned.presignedUrl, {
            body: file,
            headers: {
              "Content-Type": file.type,
            },
            method: "PUT",
          }),
        );

        if (Result.isError(uploadResult)) {
          throw new FileUploadError({
            reason: "s3-error",
            message: uploadResult.error.message,
          });
        }

        if (!uploadResult.value.ok) {
          throw new FileUploadError({
            reason: "s3-error",
            message: `Upload failed with status ${uploadResult.value.status}`,
          });
        }

        await processFile({
          data: {
            fileId,
          },
        });

        return { fileId };
      },
    }),
};
