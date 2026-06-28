import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const renameArtifactInputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
  displayName: v.pipe(v.string(), v.nonEmpty()),
  topicId: v.pipe(v.string(), v.nanoid()),
});

export const renameArtifact = createServerFn({ method: "POST" })
  .inputValidator(renameArtifactInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ data }) => {
    await db
      .update(artifact)
      .set({ displayName: data.displayName })
      .where(
        and(
          eq(artifact.id, data.artifactId),
          eq(artifact.topicId, data.topicId)
        )
      );
  });
