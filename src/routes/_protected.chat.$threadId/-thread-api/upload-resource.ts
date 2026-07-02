import { createServerFn } from "@tanstack/react-start";
import type { SerializedResult } from "better-result";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { resource } from "@/db/schema";
import type { ResourceUploadErrorShape } from "@/lib/errors/resource-upload-error";
import { ResourceUploadError } from "@/lib/errors/resource-upload-error";
import { validateUploadFile } from "@/lib/file-validation";
import {
  resourceAccessMiddleware,
  threadAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";
import { getPresignedPutUrl, S3Error } from "@/lib/s3";
import { mastra } from "@/mastra";

export const RESOURCE_UPLOAD_TTL_SECONDS = 60;

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
      id: resourceId,
      userId,
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
  ResourceUploadErrorShape
>;

const getPresignedUrlInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
  resourceId: v.pipe(v.string(), v.nanoid()),
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

      const resourceKey = await db.transaction(async (tx) => {
        const existing = await tx.query.resource.findFirst({
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
            .update(resource)
            .set({ status: "uploading" })
            .where(eq(resource.id, existing.id));

          return existing.s3Key;
        }

        const s3Key = `${context.user.id}/${topicId}/${data.resourceId}`;

        await tx.insert(resource).values({
          id: data.resourceId,
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

      if (!resourceKey) {
        return Result.ok({
          type: "skipped" as const,
        });
      }

      const presignedUrl = yield* Result.await(
        getPresignedPutUrl({
          contentLength: data.sizeBytes,
          contentType: data.mimeType,
          expiresIn: RESOURCE_UPLOAD_TTL_SECONDS,
          key: resourceKey,
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
          return new ResourceUploadError({
            reason: "s3-error",
            message: error.message,
          });
        }

        return error;
      })
    );
  });

const updateResourceStatusInputSchema = v.object({
  status: v.pipe(
    v.string(),
    v.picklist(["uploading", "processing", "ready", "failed"])
  ),
});

export const updateResourceStatus = createServerFn({ method: "POST" })
  .inputValidator(updateResourceStatusInputSchema)
  .middleware([resourceAccessMiddleware])
  .handler(async ({ context, data }) => {
    await db
      .update(resource)
      .set({ status: data.status })
      .where(eq(resource.id, context.resource.id));
  });

export const processResource = createServerFn({ method: "POST" })
  .middleware([resourceAccessMiddleware])
  .handler(async ({ context }) => {
    const workflow = mastra.getWorkflow("process-resource");
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        resourceId: context.resource.id,
        topicId: context.topicId,
      },
    });

    if (result.status === "failed") {
      throw result.error;
    }

    if (result.status !== "success") {
      throw new Error("Resource processing did not complete");
    }

    return { resourceId: context.resource.id };
  });
