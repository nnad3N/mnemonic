import { extractBytes } from "@kreuzberg/node";
// oxlint-disable promise/prefer-await-to-then
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { MDocument } from "@mastra/rag";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { embedMany } from "ai";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { resource } from "@/db/schema";
import { isImageMimeType } from "@/lib/file-validation";
import { getObject, statObject, S3Error } from "@/lib/s3";
import {
  RESOURCE_EMBEDDING_DIMENSION,
  RESOURCE_EMBEDDINGS_INDEX,
  resourceEmbeddingModel,
} from "@/mastra/resource-rag-config";
import { pgVector } from "@/mastra/storage";

const workflowInputSchema = v.object({
  resourceId: v.pipe(v.string(), v.nanoid()),
  topicId: v.pipe(v.string(), v.nanoid()),
});

type WorkflowInputSchema = v.InferInput<typeof workflowInputSchema>;

const validatedResourceSchema = v.object({
  resourceId: v.pipe(v.string(), v.nanoid()),
  displayName: v.pipe(v.string(), v.nonEmpty()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  s3Key: v.pipe(v.string(), v.nonEmpty()),
  topicId: v.pipe(v.string(), v.nanoid()),
});

const workflowOutputSchema = v.object({
  resourceId: v.pipe(v.string(), v.nanoid()),
});

const validateResourceStep = createStep({
  id: "validate-resource",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  outputSchema: toStandardJsonSchema(validatedResourceSchema),
  execute: async ({ inputData }) => {
    const { resourceId, topicId } = inputData;

    const row = await db.query.resource.findFirst({
      where: {
        id: resourceId,
        topicId,
      },
      columns: {
        displayName: true,
        id: true,
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
      resourceId: row.id,
      displayName: row.displayName,
      mimeType: row.mimeType,
      s3Key: row.s3Key,
      topicId,
    };
  },
});

const processForRagStep = createStep({
  id: "process-for-rag",
  inputSchema: toStandardJsonSchema(validatedResourceSchema),
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
  execute: async ({ inputData }) => {
    const { resourceId, displayName, mimeType, s3Key, topicId } = inputData;

    if (isImageMimeType(mimeType)) {
      await db
        .update(resource)
        .set({ status: "ready" })
        .where(eq(resource.id, resourceId));

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
        .where(eq(resource.id, resourceId));

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
      .where(eq(resource.id, resourceId));

    return { resourceId };
  },
});

export const processResourceWorkflow = createWorkflow({
  id: "process-resource",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  options: {
    onError: async ({ getInitData }) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const { resourceId } = getInitData() as WorkflowInputSchema;

      await db
        .update(resource)
        .set({ status: "failed" })
        .where(eq(resource.id, resourceId));
    },
  },
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
})
  .then(validateResourceStep)
  .then(processForRagStep)
  .commit();
