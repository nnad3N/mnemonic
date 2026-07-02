import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { file } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { rawId } from "@/lib/safe-id";
import { FILE_UPLOAD_TTL_SECONDS } from "@/routes/_protected.chat.$threadId/-thread-api/upload-file";

export const getPendingFiles = createServerFn({ method: "GET" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const uploadCutoff = new Date(Date.now() - FILE_UPLOAD_TTL_SECONDS * 1000);

    await db
      .update(file)
      .set({ status: "failed" })
      .where(
        and(
          eq(file.topicId, context.topic.id),
          eq(file.status, "uploading"),
          lt(file.updatedAt, uploadCutoff)
        )
      );

    const pendingFiles = await db
      .select({
        id: file.id,
      })
      .from(file)
      .where(
        and(
          eq(file.topicId, context.topic.id),
          inArray(file.status, ["uploading", "processing"])
        )
      );

    return pendingFiles.map((pendingFile) => ({
      id: rawId(pendingFile.id),
    }));
  });
