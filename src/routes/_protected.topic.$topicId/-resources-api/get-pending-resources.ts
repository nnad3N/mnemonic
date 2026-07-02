import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { resource } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { rawId } from "@/lib/safe-id";
import { RESOURCE_UPLOAD_TTL_SECONDS } from "@/routes/_protected.chat.$threadId/-thread-api/upload-resource";

export const getPendingResources = createServerFn({ method: "GET" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const uploadCutoff = new Date(
      Date.now() - RESOURCE_UPLOAD_TTL_SECONDS * 1000
    );

    await db
      .update(resource)
      .set({ status: "failed" })
      .where(
        and(
          eq(resource.topicId, context.topic.id),
          eq(resource.status, "uploading"),
          lt(resource.updatedAt, uploadCutoff)
        )
      );

    const pendingResources = await db
      .select({
        id: resource.id,
      })
      .from(resource)
      .where(
        and(
          eq(resource.topicId, context.topic.id),
          inArray(resource.status, ["uploading", "processing"])
        )
      );

    return pendingResources.map((pendingResource) => ({
      id: rawId(pendingResource.id),
    }));
  });
