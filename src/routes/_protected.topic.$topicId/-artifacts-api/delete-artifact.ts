import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { artifactAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { deleteObject } from "@/lib/s3";
import { ARTIFACT_EMBEDDINGS_INDEX } from "@/mastra/artifact-rag-config";
import { pgVector } from "@/mastra/storage";

export const deleteArtifact = createServerFn({ method: "POST" })
  .middleware([artifactAccessMiddleware])
  .handler(async ({ context }) => {
    const s3Result = await deleteObject(context.artifact.s3Key);

    if (Result.isError(s3Result)) {
      throw s3Result.error;
    }

    await pgVector.deleteVectors({
      indexName: ARTIFACT_EMBEDDINGS_INDEX,
      filter: { artifactId: context.artifact.id },
    });

    await db.delete(artifact).where(eq(artifact.id, context.artifact.id));

    return { id: context.artifact.id };
  });
