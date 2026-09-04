import { Result } from "better-result";
import { and, eq, inArray } from "drizzle-orm";

import { file } from "@/db/schema.server";
import type { FileStatus } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { ServerFnError, toServerFnError } from "@/lib/errors/server-fn-error";
import { validateUploadFile } from "@/lib/file-validation";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { S3Kit } from "@/lib/s3-kit.server";
import { toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";

import type { processFileWorkflow } from "./upload-file-workflow.server";

export const FILE_UPLOAD_TTL_SECONDS = 60;
export const FILE_PROCESSING_TTL_SECONDS = 300;

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
  sha256: string;
  sizeBytes: number;
  topicId: SafeId<"topic">;
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

  const pendingUpload = yield* await ctx.db.transaction(async (tx) => {
    const existing = await tx.query.file.findFirst({
      columns: { id: true, s3Key: true, status: true },
      where: {
        sha256: input.sha256,
        topicId: input.topicId,
      },
    });

    if (existing?.status === "ready" || existing?.status === "processing") return;

    if (existing) {
      await tx.update(file).set({ status: "uploading" }).where(eq(file.id, existing.id));

      return { fileId: existing.id, s3Key: existing.s3Key };
    }

    // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId write.
    const fileId = toSafeId<"file">(input.fileId);
    const s3Key = `${input.userId}/${input.topicId}/${input.fileId}`;

    await tx.insert(file).values({
      id: fileId,
      userId: input.userId,
      topicId: input.topicId,
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

type ProcessFileInput = {
  fileId: SafeId<"file">;
  topicId: SafeId<"topic">;
  userId: SafeId<"user">;
  workflow: typeof processFileWorkflow;
};

export const processFileFn = Kit.gen(async function* (
  ctx: Kits<[DbKit]>,
  { workflow, ...input }: ProcessFileInput,
) {
  const started = await Result.tryPromise(async () => {
    const run = await workflow.createRun();
    const abortSignal = AbortSignal.timeout(FILE_PROCESSING_TTL_SECONDS * 1000);

    abortSignal.addEventListener(
      "abort",
      () => {
        void run.cancel();
      },
      { once: true },
    );

    return run.start({ inputData: input });
  });

  if (Result.isError(started)) {
    yield* await markFileFailed(ctx, input.fileId, input.userId);

    return Result.err(toServerFnError.serverError("File processing could not be started"));
  }

  if (started.value.status === "failed") {
    // The workflow's onError already marks the file failed; this covers that hook's own DB write failing.
    yield* await markFileFailed(ctx, input.fileId, input.userId);

    return Result.err(
      new ServerFnError({
        message: "File processing failed",
        status: "server-error",
        cause: started.value.error,
      }),
    );
  }

  if (started.value.status !== "success") {
    yield* await markFileFailed(ctx, input.fileId, input.userId);

    return Result.err(toServerFnError.serverError("File processing did not complete"));
  }

  return Result.ok({ fileId: input.fileId });
});

type RetryFileInput = ProcessFileInput & {
  status: FileStatus;
};

export const retryFileFn = Kit.gen(async function* (ctx: Kits<[DbKit]>, input: RetryFileInput) {
  if (input.status !== "failed") {
    return Result.err(toServerFnError.badRequest("Only a failed file can be retried"));
  }

  yield* await ctx.db.run((db) =>
    db.update(file).set({ status: "uploading" }).where(eq(file.id, input.fileId)),
  );

  return processFileFn(ctx, input);
});
