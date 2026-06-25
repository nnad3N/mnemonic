import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { deleteObjects } from "@/lib/s3";
import { ARTIFACT_EMBEDDINGS_INDEX } from "@/mastra/artifact-rag-config";
import { pgVector } from "@/mastra/storage";

const deleteArtifactInputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
  topicId: v.pipe(v.string(), v.nanoid()),
});

export const deleteArtifact = createServerFn({ method: "POST" })
  .inputValidator(deleteArtifactInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ data }) => {
    const artifactRow = await db.query.artifact.findFirst({
      columns: { id: true, s3Key: true },
      where: {
        id: data.artifactId,
        topicId: data.topicId,
      },
    });

    if (!artifactRow) {
      throw notFound();
    }

    const s3Result = await deleteObjects({ keys: [artifactRow.s3Key] });

    if (Result.isError(s3Result)) {
      throw s3Result.error;
    }

    await pgVector.deleteVectors({
      indexName: ARTIFACT_EMBEDDINGS_INDEX,
      filter: { artifactId: artifactRow.id },
    });

    await db.delete(artifact).where(eq(artifact.id, artifactRow.id));

    return { id: artifactRow.id };
  });
