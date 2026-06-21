import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import type { SerializedResult } from "better-result";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { env } from "@/env";
import { FileUploadError } from "@/lib/errors/file-upload-error";
import type { FileUploadErrorShape } from "@/lib/errors/file-upload-error";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getPresignedPutUrl, S3Error } from "@/lib/s3";
import { validateUploadFile } from "@/lib/supported-files";
import { mastra } from "@/mastra";

import { threadMutationKeys } from "./query-keys";

const getTopicForUpload = async (resourceId: string, userId: string) => {
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

type GetPresignedUrlOk =
  | { type: "skipped" }
  | { type: "upload"; presignedUrl: string };

type GetPresignedUrlResult = SerializedResult<
  GetPresignedUrlOk,
  FileUploadErrorShape
>;

const getPresignedUrlInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
  artifactId: v.pipe(v.string(), v.nanoid()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  sha256: v.pipe(v.string(), v.length(64)),
  sizeBytes: v.pipe(v.number(), v.minValue(1)),
  threadId: v.pipe(v.string(), v.nanoid()),
});

const getPresignedUrl = createServerFn({ method: "POST" })
  .inputValidator(getPresignedUrlInputSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }): Promise<GetPresignedUrlResult> => {
    const result = await Result.gen(async function* () {
      yield* validateUploadFile({
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
      });

      const topicId = await getTopicForUpload(
        context.thread.resourceId,
        context.user.id
      );

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
          return existing.s3Key;
        }

        const s3Key = `${topicId}/${data.artifactId}`;

        await tx.insert(artifact).values({
          id: data.artifactId,
          topicId,
          displayName: data.displayName,
          mimeType: data.mimeType,
          s3Bucket: env.S3_BUCKET,
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
          return new FileUploadError({
            reason: "s3-error",
            message: error.message,
          });
        }

        return error;
      })
    );
  });

const processArtifactInputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nonEmpty()),
  threadId: v.pipe(v.string(), v.nonEmpty()),
});

const processArtifact = createServerFn({ method: "POST" })
  .inputValidator(processArtifactInputSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    const topicId = await getTopicForUpload(
      context.thread.resourceId,
      context.user.id
    );

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

export type UploadFileVars = {
  file: File;
  artifactId: string;
};

export const uploadFileMutation = (threadId: string) =>
  mutationOptions({
    mutationFn: async ({ file, artifactId }: UploadFileVars) => {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer()
      );
      const sha256 = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      const serialized = await getPresignedUrl({
        data: {
          displayName: file.name,
          artifactId,
          mimeType: file.type,
          sha256,
          sizeBytes: file.size,
          threadId,
        },
      });

      const result = Result.deserialize<
        GetPresignedUrlOk,
        FileUploadErrorShape
      >(serialized);

      if (Result.isError(result)) {
        throw result.error;
      }

      if (result.value.type === "skipped") {
        return { artifactId };
      }

      const uploadResponse = await fetch(result.value.presignedUrl, {
        body: file,
        headers: {
          "Content-Type": file.type,
        },
        method: "PUT",
      });

      if (!uploadResponse.ok) {
        throw new S3Error({
          message: `Upload failed with status ${uploadResponse.status}`,
          status: uploadResponse.status,
        });
      }

      await processArtifact({
        data: {
          artifactId,
          threadId,
        },
      });

      return { artifactId };
    },
    mutationKey: threadMutationKeys.uploadFile(threadId),
  });
