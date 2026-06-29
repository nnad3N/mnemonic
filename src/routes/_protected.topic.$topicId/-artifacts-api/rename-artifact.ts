import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { artifact } from "@/db/schema";
import { artifactAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const renameArtifactInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
});

export const renameArtifact = createServerFn({ method: "POST" })
  .middleware([artifactAccessMiddleware])
  .inputValidator(renameArtifactInputSchema)
  .handler(async ({ context, data }) => {
    await db
      .update(artifact)
      .set({ displayName: data.displayName })
      .where(eq(artifact.id, context.artifact.id));
  });
