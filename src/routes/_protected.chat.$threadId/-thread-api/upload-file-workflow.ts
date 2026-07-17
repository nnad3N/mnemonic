import { extractBytes } from "@kreuzberg/node";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { MDocument } from "@mastra/rag";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { embedMany } from "ai";
import { Result, TaggedError } from "better-result";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

import { file } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { isImageMimeType } from "@/lib/file-validation";
import { Kit } from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { s3Kit } from "@/lib/s3-kit";
import type { S3Kit } from "@/lib/s3-kit";
import { safeId, toSafeId } from "@/lib/safe-id";
import { vectorKit } from "@/lib/vector-kit";
import type { VectorKit } from "@/lib/vector-kit";
import { FILE_EMBEDDING_DIMENSION, fileEmbeddingModel } from "@/mastra/file-rag-config";

const workflowInputSchema = v.object({
  fileId: v.pipe(v.string(), v.nanoid()),
  topicId: v.pipe(v.string(), v.nanoid()),
  userId: v.pipe(v.string(), v.nanoid()),
});

const validatedFileSchema = v.object({
  topicId: safeId<"topic">(),
  fileId: safeId<"file">(),
  displayName: v.pipe(v.string(), v.nonEmpty()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  s3Key: v.pipe(v.string(), v.nonEmpty()),
});

type FileProcessingErrorReason = "file-not-found" | "invalid-status" | "size-mismatch";

class FileProcessingError extends TaggedError("FileProcessingError")<{
  actualSize?: number;
  expectedSize?: number;
  message: string;
  reason: FileProcessingErrorReason;
}>() {}

type ProcessFileCtx = Kits<[DbKit, S3Kit, VectorKit]>;

const validateFileFn = Kit.gen(async function* (
  ctx: ProcessFileCtx,
  input: v.InferOutput<typeof workflowInputSchema>,
) {
  const row = yield* await ctx.db.run((db) =>
    db.query.file.findFirst({
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
        id: toSafeId<"file">(input.fileId),
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
        topicId: toSafeId<"topic">(input.topicId),
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
        userId: toSafeId<"user">(input.userId),
      },
      columns: {
        id: true,
        topicId: true,
        displayName: true,
        mimeType: true,
        s3Key: true,
        sizeBytes: true,
        status: true,
      },
    }),
  );

  if (!row) {
    return Result.err(
      new FileProcessingError({
        message: "File processing input was not found",
        reason: "file-not-found",
      }),
    );
  }

  if (row.status !== "uploading") {
    return Result.err(
      new FileProcessingError({
        message: "File is not awaiting processing",
        reason: "invalid-status",
      }),
    );
  }

  const head = yield* await ctx.s3.statObject(row.s3Key);

  if (head.size !== row.sizeBytes) {
    return Result.err(
      new FileProcessingError({
        actualSize: head.size,
        expectedSize: row.sizeBytes,
        message: "Uploaded file size does not match expected size",
        reason: "size-mismatch",
      }),
    );
  }

  yield* await ctx.db.run((db) =>
    db.update(file).set({ status: "processing" }).where(eq(file.id, row.id)),
  );

  return Result.ok({
    topicId: row.topicId,
    fileId: row.id,
    displayName: row.displayName,
    mimeType: row.mimeType,
    s3Key: row.s3Key,
  });
});

const processFileCtx = Kit.createContext(dbKit, s3Kit, vectorKit);

const validateFileStep = createStep({
  id: "validate-file",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  outputSchema: toStandardJsonSchema(validatedFileSchema),
  execute: async ({ inputData }) => Kit.toException(validateFileFn)(processFileCtx, inputData),
});

const workflowOutputSchema = v.object({
  fileId: v.pipe(v.string(), v.nanoid()),
});

const processForRagFn = Kit.gen(async function* (
  ctx: ProcessFileCtx,
  input: v.InferOutput<typeof validatedFileSchema>,
) {
  if (isImageMimeType(input.mimeType)) {
    yield* await ctx.db.run((db) =>
      db.update(file).set({ status: "ready" }).where(eq(file.id, input.fileId)),
    );

    return Result.ok({ fileId: input.fileId });
  }

  const object = yield* await ctx.s3.getObject(input.s3Key);
  const chunks = yield* await Result.tryPromise(async () => {
    const extraction = await extractBytes(Buffer.from(object), input.mimeType);
    const doc = MDocument.fromText(extraction.content);

    return doc.chunk({
      strategy: "recursive",
      maxSize: 512,
      overlap: 50,
    });
  });

  if (chunks.length === 0) {
    yield* await ctx.db.run((db) =>
      db.update(file).set({ status: "ready" }).where(eq(file.id, input.fileId)),
    );

    return Result.ok({ fileId: input.fileId });
  }

  const { embeddings } = yield* await Result.tryPromise(async () =>
    embedMany({
      model: fileEmbeddingModel,
      values: chunks.map((chunk) => chunk.text),
    }),
  );

  yield* await ctx.vector.createIndex({
    dimension: FILE_EMBEDDING_DIMENSION,
    metadataIndexes: ["topicId", "fileId"],
  });

  yield* await ctx.vector.upsert({
    ids: chunks.map((_, index) => `${input.fileId}:${index}`),
    metadata: chunks.map((chunk, index) => ({
      topicId: input.topicId,
      fileId: input.fileId,
      chunkIndex: index,
      displayName: input.displayName,
      text: chunk.text,
    })),
    vectors: embeddings,
  });

  yield* await ctx.db.run((db) =>
    db.update(file).set({ status: "ready" }).where(eq(file.id, input.fileId)),
  );

  return Result.ok({ fileId: input.fileId });
});

const processForRagStep = createStep({
  id: "process-for-rag",
  inputSchema: toStandardJsonSchema(validatedFileSchema),
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
  execute: async ({ inputData }) => Kit.toException(processForRagFn)(processFileCtx, inputData),
});

export const processFileWorkflow = createWorkflow({
  id: "process-file",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  options: {
    onError: async ({ getInitData, logger }) => {
      const { fileId, userId } = v.parse(workflowInputSchema, getInitData());

      const updateResult = await Kit.get(dbKit).run((db) =>
        db
          .update(file)
          .set({ status: "failed" })
          .where(
            and(
              // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
              eq(file.id, toSafeId<"file">(fileId)),
              // oxlint-disable-next-line eslint-js/no-restricted-syntax
              eq(file.userId, toSafeId<"user">(userId)),
            ),
          ),
      );

      updateResult.tapError((error) => {
        logger.error("Failed to mark file processing as failed", {
          error,
        });
      });
    },
  },
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
})
  .then(validateFileStep)
  .then(processForRagStep)
  .commit();
