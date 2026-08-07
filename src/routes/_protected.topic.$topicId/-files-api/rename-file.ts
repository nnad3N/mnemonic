import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { file } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import * as Kit from "@/lib/kit";
import { fileAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const renameFileInputSchema = v.object({
  displayName: v.pipe(v.string(), v.nonEmpty()),
});

export const renameFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .validator(renameFileInputSchema)
  .handler(async ({ context, data }) => {
    const result = await Kit.get(dbKit).run((db) =>
      db.update(file).set({ displayName: data.displayName }).where(eq(file.id, context.file.id)),
    );

    if (Result.isError(result)) {
      throw Kit.toServerFnError.serverError("Failed to rename file");
    }
  });
