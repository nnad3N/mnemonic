import { createServerFn } from "@tanstack/react-start";
import type { SerializedResult } from "better-result";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import type { ArtifactUploadErrorShape } from "@/lib/errors/artifact-upload-error";
import { ArtifactUploadError } from "@/lib/errors/artifact-upload-error";
import { validateUploadFile } from "@/lib/file-validation";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getPresignedPutUrl, S3Error } from "@/lib/s3";
import { mastra } from "@/mastra";

export const ARTIFACT_UPLOAD_TTL_SECONDS = 60;

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
  ArtifactUploadErrorShape
>;

const getPresignedUrlInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
  artifactId: v.pipe(v.string(), v.nanoid()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  sha256: v.pipe(v.string(), v.length(64)),
  sizeBytes: v.pipe(v.number(), v.minValue(1)),
  threadId: v.pipe(v.string(), v.nanoid()),
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

      const artifactKey = await db.transaction(async (tx) => {
        const existing = await tx.query.artifact.findFirst({
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
            .update(artifact)
            .set({ status: "uploading" })
            .where(eq(artifact.id, existing.id));

          return existing.s3Key;
        }

        const s3Key = `${context.user.id}/${topicId}/${data.artifactId}`;

        await tx.insert(artifact).values({
          id: data.artifactId,
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

      if (!artifactKey) {
        return Result.ok({
          type: "skipped" as const,
        });
      }

      const presignedUrl = yield* Result.await(
        getPresignedPutUrl({
          contentLength: data.sizeBytes,
          contentType: data.mimeType,
          expiresIn: ARTIFACT_UPLOAD_TTL_SECONDS,
          key: artifactKey,
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
          return new ArtifactUploadError({
            reason: "s3-error",
            message: error.message,
          });
        }

        return error;
      })
    );
  });

const updateArtifactStatusInputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
  threadId: v.pipe(v.string(), v.nanoid()),
  status: v.pipe(
    v.string(),
    v.picklist(["uploading", "processing", "ready", "failed"])
  ),
});

export const updateArtifactStatus = createServerFn({ method: "POST" })
  .inputValidator(updateArtifactStatusInputSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ data }) => {
    await db
      .update(artifact)
      .set({ status: data.status })
      .where(eq(artifact.id, data.artifactId));
  });

const processArtifactInputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
  threadId: v.pipe(v.string(), v.nanoid()),
});

export const processArtifact = createServerFn({ method: "POST" })
  .inputValidator(processArtifactInputSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    const topicId = await getTopicForUpload({
      resourceId: context.thread.resourceId,
      userId: context.user.id,
    });

    const workflow = mastra.getWorkflow("process-artifact");
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        artifactId: data.artifactId,
        topicId,
      },
    });

    if (result.status === "failed") {
      throw result.error;
    }

    if (result.status !== "success") {
      throw new Error("Artifact processing did not complete");
    }

    return { artifactId: data.artifactId };
  });
