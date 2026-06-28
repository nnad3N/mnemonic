import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { ARTIFACT_UPLOAD_TTL_SECONDS } from "@/routes/_protected.chat.$threadId/-thread-api/upload-artifact";

export const getPendingArtifacts = createServerFn({ method: "GET" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const uploadCutoff = new Date(
      Date.now() - ARTIFACT_UPLOAD_TTL_SECONDS * 1000
    );

    await db
      .update(artifact)
      .set({ status: "failed" })
      .where(
        and(
          eq(artifact.topicId, context.topic.id),
          eq(artifact.status, "uploading"),
          lt(artifact.updatedAt, uploadCutoff)
        )
      );

    return db
      .select({
        id: artifact.id,
      })
      .from(artifact)
      .where(
        and(
          eq(artifact.topicId, context.topic.id),
          inArray(artifact.status, ["uploading", "processing"])
        )
      );
  });
