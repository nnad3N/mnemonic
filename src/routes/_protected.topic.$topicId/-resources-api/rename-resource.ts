import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { resource } from "@/db/schema";
import { resourceAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const renameResourceInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
});

export const renameResource = createServerFn({ method: "POST" })
  .middleware([resourceAccessMiddleware])
  .inputValidator(renameResourceInputSchema)
  .handler(async ({ context, data }) => {
    await db
      .update(resource)
      .set({ displayName: data.displayName })
      .where(eq(resource.id, context.resource.id));
  });
