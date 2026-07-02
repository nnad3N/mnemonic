import { extractBytes } from "@kreuzberg/node";
// oxlint-disable promise/prefer-await-to-then
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { MDocument } from "@mastra/rag";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { embedMany } from "ai";
import { Result } from "better-result";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { file } from "@/db/schema";
import { isImageMimeType } from "@/lib/file-validation";
import { getObject, statObject, S3Error } from "@/lib/s3";
import { safeId, toSafeId } from "@/lib/safe-id";
import {
  FILE_EMBEDDING_DIMENSION,
  FILE_EMBEDDINGS_INDEX,
  fileEmbeddingModel,
} from "@/mastra/file-rag-config";
import { pgVector } from "@/mastra/storage";

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

const validateFileStep = createStep({
  id: "validate-file",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  outputSchema: toStandardJsonSchema(validatedFileSchema),
  execute: async ({ inputData }) => {
    const row = await db.query.file.findFirst({
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
        id: toSafeId<"file">(inputData.fileId),
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
        topicId: toSafeId<"topic">(inputData.topicId),
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
        userId: toSafeId<"user">(inputData.userId),
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
    });

    if (row === undefined) {
      throw new Error("File not found");
    }

    if (row.status !== "uploading") {
      throw new Error("File is not awaiting upload");
    }

    const headResult = await statObject(row.s3Key);

    if (Result.isError(headResult)) {
      throw headResult.error;
    }

    if (headResult.value.size !== row.sizeBytes) {
      throw new S3Error({
        message: `Uploaded size ${headResult.value.size} does not match expected ${row.sizeBytes}`,
      });
    }

    await db
      .update(file)
      .set({ status: "processing" })
      .where(eq(file.id, row.id));

    return {
      topicId: row.topicId,
      fileId: row.id,
      displayName: row.displayName,
      mimeType: row.mimeType,
      s3Key: row.s3Key,
    };
  },
});

const workflowOutputSchema = v.object({
  fileId: v.pipe(v.string(), v.nanoid()),
});

const processForRagStep = createStep({
  id: "process-for-rag",
  inputSchema: toStandardJsonSchema(validatedFileSchema),
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
  execute: async ({ inputData }) => {
    const { displayName, mimeType, fileId, s3Key, topicId } = inputData;

    if (isImageMimeType(mimeType)) {
      await db
        .update(file)
        .set({ status: "ready" })
        .where(and(eq(file.id, fileId)));

      return { fileId };
    }

    const objectResult = await getObject(s3Key);

    if (Result.isError(objectResult)) {
      throw objectResult.error;
    }

    const extraction = await extractBytes(
      Buffer.from(objectResult.value),
      mimeType
    );

    const doc = MDocument.fromText(extraction.content);
    const chunks = await doc.chunk({
      strategy: "recursive",
      maxSize: 512,
      overlap: 50,
    });

    if (chunks.length === 0) {
      await db
        .update(file)
        .set({ status: "ready" })
        .where(and(eq(file.id, fileId)));

      return { fileId };
    }

    const { embeddings } = await embedMany({
      model: fileEmbeddingModel,
      values: chunks.map((chunk) => chunk.text),
    });

    await pgVector.createIndex({
      dimension: FILE_EMBEDDING_DIMENSION,
      indexName: FILE_EMBEDDINGS_INDEX,
      metadataIndexes: ["topicId", "fileId"],
    });

    await pgVector.upsert({
      ids: chunks.map((_, index) => `${fileId}:${index}`),
      indexName: FILE_EMBEDDINGS_INDEX,
      metadata: chunks.map((chunk, index) => ({
        topicId,
        fileId,
        chunkIndex: index,
        displayName,
        text: chunk.text,
      })),
      vectors: embeddings,
    });

    await db
      .update(file)
      .set({ status: "ready" })
      .where(and(eq(file.id, fileId)));

    return { fileId };
  },
});

export const processFileWorkflow = createWorkflow({
  id: "process-file",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  options: {
    onError: async ({ getInitData }) => {
      const inputData = v.parse(workflowInputSchema, getInitData());

      await db
        .update(file)
        .set({ status: "failed" })
        .where(
          and(
            // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
            eq(file.id, toSafeId<"file">(inputData.fileId)),
            // oxlint-disable-next-line eslint-js/no-restricted-syntax
            eq(file.userId, toSafeId<"user">(inputData.userId))
          )
        );
    },
  },
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
})
  .then(validateFileStep)
  .then(processForRagStep)
  .commit();
