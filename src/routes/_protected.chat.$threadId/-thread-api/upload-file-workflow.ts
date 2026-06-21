// oxlint-disable promise/prefer-await-to-then
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { headObject, S3Error } from "@/lib/s3";

const workflowInputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nonEmpty()),
  topicId: v.pipe(v.string(), v.nonEmpty()),
});

type WorkflowInputSchema = v.InferInput<typeof workflowInputSchema>;

const validatedArtifactSchema = v.object({
  artifactId: v.pipe(v.string(), v.nonEmpty()),
  s3Bucket: v.pipe(v.string(), v.nonEmpty()),
  s3Key: v.pipe(v.string(), v.nonEmpty()),
});

const workflowOutputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nonEmpty()),
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
        id: true,
        s3Bucket: true,
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

    const headResult = await headObject({ key: row.s3Key });

    if (Result.isError(headResult)) {
      throw headResult.error;
    }

    if (headResult.value.contentLength !== row.sizeBytes) {
      throw new S3Error({
        message: `Uploaded size ${headResult.value.contentLength} does not match expected ${row.sizeBytes}`,
      });
    }

    await db
      .update(artifact)
      .set({ status: "processing" })
      .where(eq(artifact.id, row.id));

    return {
      artifactId: row.id,
      s3Bucket: row.s3Bucket,
      s3Key: row.s3Key,
    };
  },
});

const processForRagStep = createStep({
  id: "process-for-rag",
  inputSchema: toStandardJsonSchema(validatedArtifactSchema),
  outputSchema: toStandardJsonSchema(workflowOutputSchema),
  execute: async ({ inputData }) => {
    const { artifactId } = inputData;

    await Bun.sleep(2000);

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
