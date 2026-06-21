import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { env } from "@/env";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getPresignedPutUrl, S3Error } from "@/lib/s3";
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

type GetPresignedUrlResult =
  | { type: "skipped"; artifactId: string }
  | { type: "upload"; artifactId: string; presignedUrl: string };

const getPresignedUrlInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
  fileId: v.pipe(v.string(), v.nonEmpty()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  sha256: v.pipe(v.string(), v.length(64)),
  sizeBytes: v.pipe(v.number(), v.minValue(1)),
  threadId: v.pipe(v.string(), v.nonEmpty()),
});

const getPresignedUrl = createServerFn({ method: "POST" })
  .inputValidator(getPresignedUrlInputSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    const topicId = await getTopicForUpload(
      context.thread.resourceId,
      context.user.id
    );

    const resolution = await db.transaction(async (tx) => {
      const existing = await tx.query.artifact.findFirst({
        where: {
          sha256: data.sha256,
          topicId,
        },
      });

      if (existing?.status === "ready" || existing?.status === "processing") {
        return {
          artifactId: existing.id,
          s3Key: undefined,
        };
      }

      if (existing) {
        return {
          artifactId: existing.id,
          s3Key: existing.s3Key,
        };
      }

      const s3Key = `${topicId}/${data.fileId}`;

      await tx.insert(artifact).values({
        displayName: data.displayName,
        id: data.fileId,
        mimeType: data.mimeType,
        s3Bucket: env.S3_BUCKET,
        s3Key,
        sha256: data.sha256,
        sizeBytes: data.sizeBytes,
        status: "uploading",
        topicId,
      });

      return {
        artifactId: data.fileId,
        s3Key,
      };
    });

    if (!resolution.s3Key) {
      return {
        type: "skipped",
        artifactId: resolution.artifactId,
      } satisfies GetPresignedUrlResult;
    }

    const presignedResult = await getPresignedPutUrl({
      contentLength: data.sizeBytes,
      contentType: data.mimeType,
      key: resolution.s3Key,
    });

    if (Result.isError(presignedResult)) {
      throw presignedResult.error;
    }

    return {
      type: "upload",
      artifactId: resolution.artifactId,
      presignedUrl: presignedResult.value,
    };
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
  fileId: string;
};

export const uploadFileMutation = (threadId: string) =>
  mutationOptions({
    mutationFn: async ({ file, fileId }: UploadFileVars) => {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        await file.arrayBuffer()
      );
      const sha256 = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      const result = await getPresignedUrl({
        data: {
          displayName: file.name,
          fileId,
          mimeType: file.type,
          sha256,
          sizeBytes: file.size,
          threadId,
        },
      });

      if (result.type === "skipped") {
        return { artifactId: result.artifactId };
      }

      const uploadResponse = await fetch(result.presignedUrl, {
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
          artifactId: result.artifactId,
          threadId,
        },
      });

      return { artifactId: result.artifactId };
    },
    mutationKey: threadMutationKeys.uploadFile(threadId),
  });
