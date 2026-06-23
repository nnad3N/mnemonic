import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, lt } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";

import { threadKeys } from "./query-keys";
import { ARTIFACT_UPLOAD_TTL_SECONDS } from "./upload-artifact";

const getMentionsInputSchema = v.object({
  topicId: v.pipe(v.string(), v.nanoid()),
});

export const getMentions = createServerFn({ method: "GET" })
  .inputValidator(getMentionsInputSchema)
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
        displayName: artifact.displayName,
        sha256: artifact.sha256,
        status: artifact.status,
      })
      .from(artifact)
      .where(eq(artifact.topicId, data.topicId))
      .orderBy(desc(artifact.createdAt));
  });

export const mentionsQuery = (topicId?: string) =>
  queryOptions({
    queryFn: async () => {
      if (!topicId) {
        return [];
      }

      return getMentions({
        data: { topicId },
      });
    },
    queryKey: threadKeys.mentions(topicId),
  });
