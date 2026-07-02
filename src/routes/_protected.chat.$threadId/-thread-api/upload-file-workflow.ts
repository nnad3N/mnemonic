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
import { resource } from "@/db/schema";
import { isImageMimeType } from "@/lib/file-validation";
import { getObject, statObject, S3Error } from "@/lib/s3";
import { safeId, toSafeId } from "@/lib/safe-id";
import {
  RESOURCE_EMBEDDING_DIMENSION,
  RESOURCE_EMBEDDINGS_INDEX,
  resourceEmbeddingModel,
} from "@/mastra/resource-rag-config";
import { pgVector } from "@/mastra/storage";

const workflowInputSchema = v.object({
  resourceId: v.pipe(v.string(), v.nanoid()),
  topicId: v.pipe(v.string(), v.nanoid()),
  userId: v.pipe(v.string(), v.nanoid()),
});

const validatedResourceSchema = v.object({
  topicId: safeId<"topic">(),
  resourceId: safeId<"resource">(),
  displayName: v.pipe(v.string(), v.nonEmpty()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  s3Key: v.pipe(v.string(), v.nonEmpty()),
});

const validateResourceStep = createStep({
  id: "validate-resource",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  outputSchema: toStandardJsonSchema(validatedResourceSchema),
  execute: async ({ inputData }) => {
    const row = await db.query.resource.findFirst({
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- ownership check.
        id: toSafeId<"resource">(inputData.resourceId),
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
      throw new Error("Resource not found");
    }

    if (row.status !== "uploading") {
      throw new Error("Resource is not awaiting upload");
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
      .update(resource)
      .set({ status: "processing" })
      .where(eq(resource.id, row.id));

    return {
      topicId: row.topicId,
      resourceId: row.id,
      displayName: row.displayName,
      mimeType: row.mimeType,
      s3Key: row.s3Key,
    };
  },
});

const workflowOutputSchema = v.object({
  resourceId: v.pipe(v.string(), v.nanoid()),
});

const processForRagStep = createStep({
  id: "process-for-rag",
  inputSchema: toStandardJsonSchema(validatedResourceSchema),
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
  execute: async ({ inputData }) => {
    const { displayName, mimeType, resourceId, s3Key, topicId } = inputData;

    if (isImageMimeType(mimeType)) {
      await db
        .update(resource)
        .set({ status: "ready" })
        .where(and(eq(resource.id, resourceId)));

      return { resourceId };
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
        .update(resource)
        .set({ status: "ready" })
        .where(and(eq(resource.id, resourceId)));

      return { resourceId };
    }

    const { embeddings } = await embedMany({
      model: resourceEmbeddingModel,
      values: chunks.map((chunk) => chunk.text),
    });

    await pgVector.createIndex({
      dimension: RESOURCE_EMBEDDING_DIMENSION,
      indexName: RESOURCE_EMBEDDINGS_INDEX,
      metadataIndexes: ["topicId", "resourceId"],
    });

    await pgVector.upsert({
      ids: chunks.map((_, index) => `${resourceId}:${index}`),
      indexName: RESOURCE_EMBEDDINGS_INDEX,
      metadata: chunks.map((chunk, index) => ({
        topicId,
        resourceId,
        chunkIndex: index,
        displayName,
        text: chunk.text,
      })),
      vectors: embeddings,
    });

    await db
      .update(resource)
      .set({ status: "ready" })
      .where(and(eq(resource.id, resourceId)));

    return { resourceId };
  },
});

export const processResourceWorkflow = createWorkflow({
  id: "process-resource",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  options: {
    onError: async ({ getInitData }) => {
      const inputData = v.parse(workflowInputSchema, getInitData());

      await db
        .update(resource)
        .set({ status: "failed" })
        .where(
          and(
            // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
            eq(resource.id, toSafeId<"resource">(inputData.resourceId)),
            // oxlint-disable-next-line eslint-js/no-restricted-syntax
            eq(resource.userId, toSafeId<"user">(inputData.userId))
          )
        );
    },
  },
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
})
  .then(validateResourceStep)
  .then(processForRagStep)
  .commit();
