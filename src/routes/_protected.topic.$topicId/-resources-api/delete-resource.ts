import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { resource } from "@/db/schema";
import { resourceAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { deleteObject } from "@/lib/s3";
import { RESOURCE_EMBEDDINGS_INDEX } from "@/mastra/resource-rag-config";
import { pgVector } from "@/mastra/storage";

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([resourceAccessMiddleware])
  .handler(async ({ context }) => {
    const s3Result = await deleteObject(context.resource.s3Key);

    if (Result.isError(s3Result)) {
      throw s3Result.error;
    }

    await pgVector.deleteVectors({
      indexName: RESOURCE_EMBEDDINGS_INDEX,
      filter: { resourceId: context.resource.id },
    });

    await db.delete(resource).where(eq(resource.id, context.resource.id));

    return { id: context.resource.id };
  });
