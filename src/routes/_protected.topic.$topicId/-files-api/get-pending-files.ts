import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { and, eq, inArray, lt } from "drizzle-orm";

import { file } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { rawId } from "@/lib/safe-id";
import { FILE_UPLOAD_TTL_SECONDS } from "@/routes/_protected.chat.$threadId/-thread-api/upload-file";

export const getPendingFiles = createServerFn({ method: "GET" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const uploadCutoff = new Date(
      Temporal.Now.instant().subtract({ seconds: FILE_UPLOAD_TTL_SECONDS }).epochMilliseconds,
    );

    const result = await Kit.get(dbKit).run(async (db) => {
      await db
        .update(file)
        .set({ status: "failed" })
        .where(
          and(
            eq(file.topicId, context.topic.id),
            eq(file.status, "uploading"),
            lt(file.updatedAt, uploadCutoff),
          ),
        );

      return db
        .select({
          id: file.id,
        })
        .from(file)
        .where(
          and(
            eq(file.topicId, context.topic.id),
            inArray(file.status, ["uploading", "processing"]),
          ),
        );
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to list pending files");
    }

    return result.value.map((pendingFile) => ({
      id: rawId(pendingFile.id),
    }));
  });
