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
import { artifact } from "@/db/schema";
import { isImageMimeType } from "@/lib/file-validation";
import { getObject, statObject, S3Error } from "@/lib/s3";
import {
  ARTIFACT_EMBEDDING_DIMENSION,
  ARTIFACT_EMBEDDINGS_INDEX,
  artifactEmbeddingModel,
} from "@/mastra/artifact-rag-config";
import { pgVector } from "@/mastra/storage";

const workflowInputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
  topicId: v.pipe(v.string(), v.nanoid()),
});

type WorkflowInputSchema = v.InferInput<typeof workflowInputSchema>;

const validatedArtifactSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
  displayName: v.pipe(v.string(), v.nonEmpty()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  s3Key: v.pipe(v.string(), v.nonEmpty()),
  topicId: v.pipe(v.string(), v.nanoid()),
});

const workflowOutputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
});

const validateArtifactStep = createStep({
  id: "validate-artifact",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  outputSchema: toStandardJsonSchema(validatedArtifactSchema),
  execute: async ({ inputData }) => {
    const { artifactId, topicId } = inputData;

    const row = await db.query.artifact.findFirst({
      where: {
        id: artifactId,
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
      throw new Error("Artifact not found");
    }

    if (row.status !== "uploading") {
      throw new Error("Artifact is not awaiting upload");
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
      .update(artifact)
      .set({ status: "processing" })
      .where(eq(artifact.id, row.id));

    return {
      artifactId: row.id,
      displayName: row.displayName,
      mimeType: row.mimeType,
      s3Key: row.s3Key,
      topicId,
    };
  },
});

const processForRagStep = createStep({
  id: "process-for-rag",
  inputSchema: toStandardJsonSchema(validatedArtifactSchema),
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
  execute: async ({ inputData }) => {
    const { artifactId, displayName, mimeType, s3Key, topicId } = inputData;

    if (isImageMimeType(mimeType)) {
      await db
        .update(artifact)
        .set({ status: "ready" })
        .where(eq(artifact.id, artifactId));

      return { artifactId };
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
        .update(artifact)
        .set({ status: "ready" })
        .where(eq(artifact.id, artifactId));

      return { artifactId };
    }

    const { embeddings } = await embedMany({
      model: artifactEmbeddingModel,
      values: chunks.map((chunk) => chunk.text),
    });

    await pgVector.createIndex({
      dimension: ARTIFACT_EMBEDDING_DIMENSION,
      indexName: ARTIFACT_EMBEDDINGS_INDEX,
      metadataIndexes: ["topicId", "artifactId"],
    });

    await pgVector.upsert({
      ids: chunks.map((_, index) => `${artifactId}:${index}`),
      indexName: ARTIFACT_EMBEDDINGS_INDEX,
      metadata: chunks.map((chunk, index) => ({
        topicId,
        artifactId,
        chunkIndex: index,
        displayName,
        text: chunk.text,
      })),
      vectors: embeddings,
    });

    await db
      .update(artifact)
      .set({ status: "ready" })
      .where(eq(artifact.id, artifactId));

    return { artifactId };
  },
});

export const processArtifactWorkflow = createWorkflow({
  id: "process-artifact",
  inputSchema: toStandardJsonSchema(workflowInputSchema),
  options: {
    onError: async ({ getInitData }) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const { artifactId } = getInitData() as WorkflowInputSchema;

      await db
        .update(artifact)
        .set({ status: "failed" })
        .where(eq(artifact.id, artifactId));
    },
  },
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
})
  .then(validateArtifactStep)
  .then(processForRagStep)
  .commit();
