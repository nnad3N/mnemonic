import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { file } from "@/db/schema";
import { fileAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { deleteObject } from "@/lib/s3";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/file-rag-config";
import { pgVector } from "@/mastra/storage";

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) => {
    const s3Result = await deleteObject(context.file.s3Key);

    if (Result.isError(s3Result)) {
      throw s3Result.error;
    }

    await pgVector.deleteVectors({
      indexName: FILE_EMBEDDINGS_INDEX,
      filter: { fileId: context.file.id },
    });

    await db.delete(file).where(eq(file.id, context.file.id));

    return { id: context.file.id };
  });
