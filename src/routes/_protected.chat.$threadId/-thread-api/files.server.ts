import { Result } from "better-result";
import { and, eq, inArray } from "drizzle-orm";

import { file } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { ServerFnError } from "@/lib/errors/server-fn-error";
import { validateUploadFile } from "@/lib/file-validation";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { S3Kit } from "@/lib/s3-kit.server";
import { toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";

export const FILE_UPLOAD_TTL_SECONDS = 60;
export const FILE_PROCESSING_TTL_SECONDS = 60;

type UploadFileCtx = Kits<[DbKit, S3Kit]>;

export const markFileFailed = async (
  ctx: Kits<[DbKit]>,
  fileId: SafeId<"file">,
  userId: SafeId<"user">,
) =>
  ctx.db.run((db) =>
    db
      .update(file)
      .set({ status: "failed" })
      .where(
        and(
          eq(file.id, fileId),
          eq(file.userId, userId),
          inArray(file.status, ["uploading", "processing"]),
        ),
      ),
  );

type GetPresignedUrlInput = {
  displayName: string;
  fileId: string;
  mimeType: string;
  resourceId: string;
  sha256: string;
  sizeBytes: number;
  userId: SafeId<"user">;
};

export const getPresignedUrlFn = Kit.gen(async function* (
  ctx: UploadFileCtx,
  input: GetPresignedUrlInput,
) {
  yield* validateUploadFile({
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });

  const ownedTopic = yield* await ctx.db.run(async (db) =>
    db.query.topic.findFirst({
      columns: { id: true },
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
        id: toSafeId<"topic">(input.resourceId),
        userId: input.userId,
      },
    }),
  );

  if (!ownedTopic) {
    return Result.err(
      new ServerFnError({
        message: "File uploads are only supported in topic threads",
        status: "bad-request",
      }),
    );
  }

  const topicId = ownedTopic.id;

  const pendingUpload = yield* await ctx.db.transaction(async (tx) => {
    const existing = await tx.query.file.findFirst({
      columns: { id: true, s3Key: true, status: true },
      where: {
        sha256: input.sha256,
        topicId,
      },
    });

    if (existing?.status === "ready" || existing?.status === "processing") return;

    if (existing) {
      await tx.update(file).set({ status: "uploading" }).where(eq(file.id, existing.id));

      return { fileId: existing.id, s3Key: existing.s3Key };
    }

    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId write.
    const fileId = toSafeId<"file">(input.fileId);
    const s3Key = `${input.userId}/${topicId}/${input.fileId}`;

    await tx.insert(file).values({
      id: fileId,
      userId: input.userId,
      topicId,
      displayName: input.displayName,
      mimeType: input.mimeType,
      s3Key,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      status: "uploading",
    });

    return { fileId, s3Key };
  });

  if (!pendingUpload) {
    return Result.ok({
      type: "skipped" as const,
    });
  }

  const presignedUrl = await ctx.s3.getPresignedPutUrl({
    contentLength: input.sizeBytes,
    contentType: input.mimeType,
    expiresIn: FILE_UPLOAD_TTL_SECONDS,
    key: pendingUpload.s3Key,
  });

  if (Result.isError(presignedUrl)) {
    await markFileFailed(ctx, pendingUpload.fileId, input.userId);

    return presignedUrl;
  }

  return Result.ok({
    type: "upload" as const,
    presignedUrl: presignedUrl.value,
  });
});
