import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const findArtifactsBySha256InputSchema = v.object({
  topicId: v.pipe(v.string(), v.nanoid()),
  sha256s: v.array(v.pipe(v.string(), v.nonEmpty())),
});

export const findArtifactsBySha256 = createServerFn({ method: "GET" })
  .inputValidator(findArtifactsBySha256InputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ data }) => {
    return db
      .select({
        id: artifact.id,
        sha256: artifact.sha256,
        status: artifact.status,
      })
      .from(artifact)
      .where(
        and(
          eq(artifact.topicId, data.topicId),
          inArray(artifact.sha256, data.sha256s)
        )
      );
  });
