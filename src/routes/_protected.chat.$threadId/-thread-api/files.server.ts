import { Result } from "better-result";
import { and, eq, inArray } from "drizzle-orm";

import { file } from "@/db/schema.server";
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

  // Same bytes in the topic restart the existing row unless it is processing or ready, in which
  // case nothing is returned; the existing row keeps its id, name and key.
  const restarted = yield* await ctx.db.run((db) =>
    db
      .insert(file)
      .values({
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId write.
        id: toSafeId<"file">(input.fileId),
        userId: input.userId,
        topicId: input.topicId,
        displayName: input.displayName,
        mimeType: input.mimeType,
        s3Key: `${input.userId}/${input.topicId}/${input.fileId}`,
        sha256: input.sha256,
        sizeBytes: input.sizeBytes,
        status: "uploading",
      })
      .onConflictDoUpdate({
        target: [file.topicId, file.sha256],
        set: { status: "uploading" },
        setWhere: inArray(file.status, ["uploading", "failed"]),
      })
      .returning({ fileId: file.id, s3Key: file.s3Key }),
  );
  const pendingUpload = restarted.at(0);

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

export const retryFileFn = Kit.gen(async function* (ctx: Kits<[DbKit]>, input: ProcessFileInput) {
  const retried = yield* await ctx.db.run((db) =>
    db
      .update(file)
      .set({ status: "uploading" })
      .where(and(eq(file.id, input.fileId), eq(file.status, "failed")))
      .returning({ id: file.id }),
  );

  if (retried.length === 0) {
    return Result.err(toServerFnError.badRequest("Only a failed file can be retried"));
  }

  return processFileFn(ctx, input);
});
