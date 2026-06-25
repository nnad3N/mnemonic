import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { ARTIFACT_UPLOAD_TTL_SECONDS } from "@/routes/_protected.chat.$threadId/-thread-api/upload-artifact";

import { topicKeys } from "../-topic-api/query-keys";

const getPendingArtifactsInputSchema = v.object({
  topicId: v.pipe(v.string(), v.nanoid()),
});

export const getPendingArtifacts = createServerFn({ method: "GET" })
  .inputValidator(getPendingArtifactsInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ data }) => {
    const uploadCutoff = new Date(
      Date.now() - ARTIFACT_UPLOAD_TTL_SECONDS * 1000
    );

    await db
      .update(artifact)
      .set({ status: "failed" })
      .where(
        and(
          eq(artifact.topicId, data.topicId),
          eq(artifact.status, "uploading"),
          lt(artifact.updatedAt, uploadCutoff)
        )
      );

    return db
      .select({
        id: artifact.id,
        status: artifact.status,
      })
      .from(artifact)
      .where(
        and(
          eq(artifact.topicId, data.topicId),
          inArray(artifact.status, ["uploading", "processing"])
        )
      )
      .orderBy(desc(artifact.updatedAt));
  });

export const pendingArtifactsQuery = (topicId: string) =>
  queryOptions({
    queryFn: async () =>
      getPendingArtifacts({
        data: { topicId },
      }),
    queryKey: [...topicKeys.artifacts(topicId), "pending"] as const,
  });
