import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { file } from "@/db/schema";
import { fileAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const renameFileInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
});

export const renameFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .validator(renameFileInputSchema)
  .handler(async ({ context, data }) => {
    await db
      .update(file)
      .set({ displayName: data.displayName })
      .where(eq(file.id, context.file.id));
  });
