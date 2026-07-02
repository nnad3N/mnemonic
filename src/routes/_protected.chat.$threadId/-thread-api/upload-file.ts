import { createServerFn } from "@tanstack/react-start";
import type { SerializedResult } from "better-result";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { file } from "@/db/schema";
import type { FileUploadErrorShape } from "@/lib/errors/file-upload-error";
import { FileUploadError } from "@/lib/errors/file-upload-error";
import { validateUploadFile } from "@/lib/file-validation";
import {
  fileAccessMiddleware,
  threadAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";
import { getPresignedPutUrl, S3Error } from "@/lib/s3";
import { toSafeId } from "@/lib/safe-id";
import { mastra } from "@/mastra";

export const FILE_UPLOAD_TTL_SECONDS = 60;

type GetTopicForUploadProps = {
  resourceId: string;
  userId: string;
};

const getTopicForUpload = async ({
  resourceId,
  userId,
}: GetTopicForUploadProps) => {
  const ownedTopic = await db.query.topic.findFirst({
    columns: { id: true },
    where: {
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
      id: toSafeId<"topic">(resourceId),
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
      userId: toSafeId<"user">(userId),
    },
  });

  if (!ownedTopic) {
    throw new Error("File uploads are only supported in topic threads");
  }

  return ownedTopic.id;
};

export type GetPresignedUrlOk =
  | { type: "skipped" }
  | { type: "upload"; presignedUrl: string };

export type GetPresignedUrlResult = SerializedResult<
  GetPresignedUrlOk,
  FileUploadErrorShape
>;

const getPresignedUrlInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
  fileId: v.pipe(v.string(), v.nanoid()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  sha256: v.pipe(v.string(), v.length(64)),
  sizeBytes: v.pipe(v.number(), v.minValue(1)),
});

export const getPresignedUrl = createServerFn({ method: "POST" })
  .inputValidator(getPresignedUrlInputSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }): Promise<GetPresignedUrlResult> => {
    const result = await Result.gen(async function* () {
      yield* validateUploadFile({
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
      });

      const topicId = await getTopicForUpload({
        resourceId: context.thread.resourceId,
        userId: context.user.id,
      });

      const fileKey = await db.transaction(async (tx) => {
        const existing = await tx.query.file.findFirst({
          columns: { id: true, s3Key: true, status: true },
          where: {
            sha256: data.sha256,
            topicId,
          },
        });

        if (existing?.status === "ready" || existing?.status === "processing") {
          return;
        }

        if (existing) {
          await tx
            .update(file)
            .set({ status: "uploading" })
            .where(eq(file.id, existing.id));

          return existing.s3Key;
        }

        const s3Key = `${context.user.id}/${topicId}/${data.fileId}`;

        await tx.insert(file).values({
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId write.
          id: toSafeId<"file">(data.fileId),
          userId: context.user.id,
          topicId,
          displayName: data.displayName,
          mimeType: data.mimeType,
          s3Key,
          sha256: data.sha256,
          sizeBytes: data.sizeBytes,
          status: "uploading",
        });

        return s3Key;
      });

      if (!fileKey) {
        return Result.ok({
          type: "skipped" as const,
        });
      }

      const presignedUrl = yield* Result.await(
        getPresignedPutUrl({
          contentLength: data.sizeBytes,
          contentType: data.mimeType,
          expiresIn: FILE_UPLOAD_TTL_SECONDS,
          key: fileKey,
        })
      );

      return Result.ok({
        type: "upload" as const,
        presignedUrl,
      });
    });

    return Result.serialize(
      result.mapError((error) => {
        if (S3Error.is(error)) {
          return new FileUploadError({
            reason: "s3-error",
            message: error.message,
          });
        }

        return error;
      })
    );
  });

const updateFileStatusInputSchema = v.object({
  status: v.pipe(
    v.string(),
    v.picklist(["uploading", "processing", "ready", "failed"])
  ),
});

export const updateFileStatus = createServerFn({ method: "POST" })
  .inputValidator(updateFileStatusInputSchema)
  .middleware([fileAccessMiddleware])
  .handler(async ({ context, data }) => {
    await db
      .update(file)
      .set({ status: data.status })
      .where(eq(file.id, context.file.id));
  });

export const processFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) => {
    const workflow = mastra.getWorkflow("process-file");
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        fileId: context.file.id,
        topicId: context.topicId,
        userId: context.user.id,
      },
    });

    if (result.status === "failed") {
      throw result.error;
    }

    if (result.status !== "success") {
      throw new Error("File processing did not complete");
    }

    return { fileId: context.file.id };
  });
