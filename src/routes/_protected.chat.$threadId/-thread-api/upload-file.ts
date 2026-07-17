import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { file } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { validateUploadFile } from "@/lib/file-validation";
import { Kit, ServerFnError, toServerFnError } from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import {
  fileAccessMiddleware,
  threadAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";
import { s3Kit } from "@/lib/s3-kit";
import type { S3Kit } from "@/lib/s3-kit";
import { toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { mastra } from "@/mastra";

export const FILE_UPLOAD_TTL_SECONDS = 60;

type UploadFileCtx = Kits<[DbKit, S3Kit]>;

type GetPresignedUrlInput = {
  displayName: string;
  fileId: string;
  mimeType: string;
  resourceId: string;
  sha256: string;
  sizeBytes: number;
  userId: SafeId<"user">;
};

const getPresignedUrlFn = Kit.gen(async function* (
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

  const fileKey = yield* await ctx.db.transaction(async (tx) => {
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

      return existing.s3Key;
    }

    const s3Key = `${input.userId}/${topicId}/${input.fileId}`;

    await tx.insert(file).values({
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId write.
      id: toSafeId<"file">(input.fileId),
      userId: input.userId,
      topicId,
      displayName: input.displayName,
      mimeType: input.mimeType,
      s3Key,
      sha256: input.sha256,
      sizeBytes: input.sizeBytes,
      status: "uploading",
    });

    return s3Key;
  });

  if (!fileKey) {
    return Result.ok({
      type: "skipped" as const,
    });
  }

  const presignedUrl = yield* await ctx.s3.getPresignedPutUrl({
    contentLength: input.sizeBytes,
    contentType: input.mimeType,
    expiresIn: FILE_UPLOAD_TTL_SECONDS,
    key: fileKey,
  });

  return Result.ok({
    type: "upload" as const,
    presignedUrl,
  });
});

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
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      getPresignedUrlFn(uploadFileCtx, {
        displayName: data.displayName,
        fileId: data.fileId,
        mimeType: data.mimeType,
        resourceId: context.thread.resourceId,
        sha256: data.sha256,
        sizeBytes: data.sizeBytes,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) => {
      if (ServerFnError.is(error)) {
        return error;
      }

      return matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to prepare file upload"),
        FileUploadError: (fileUploadError) => toServerFnError.serverError(fileUploadError.message),
        S3Error: () => toServerFnError.serverError("Failed to prepare file upload"),
      });
    }),
  );

const updateFileStatusInputSchema = v.object({
  status: v.pipe(v.string(), v.picklist(["uploading", "processing", "ready", "failed"])),
});

export const updateFileStatus = createServerFn({ method: "POST" })
  .validator(updateFileStatusInputSchema)
  .middleware([fileAccessMiddleware])
  .handler(async ({ context, data }) => {
    const result = await Kit.get(dbKit).run((db) =>
      db.update(file).set({ status: data.status }).where(eq(file.id, context.file.id)),
    );

    if (result.isErr()) {
      throw toServerFnError.serverError("Failed to update file status");
    }
  });

export const processFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) => {
    const workflowResult = await Result.tryPromise(async () => {
      const workflow = mastra.getWorkflow("process-file");
      const run = await workflow.createRun();

      return run.start({
        inputData: {
          fileId: context.file.id,
          topicId: context.topicId,
          userId: context.user.id,
        },
      });
    });

    if (Result.isError(workflowResult)) {
      throw toServerFnError.serverError("File processing could not be started");
    }

    const result = workflowResult.value;

    if (result.status === "failed") {
      throw new ServerFnError({
        message: "File processing failed",
        status: "server-error",
        cause: result.error,
      });
    }

    if (result.status !== "success") {
      throw new ServerFnError({
        message: "File processing did not complete",
        status: "server-error",
      });
    }

    return { fileId: context.file.id };
  });
