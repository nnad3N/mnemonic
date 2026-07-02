import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { file } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const findFilesBySha256InputSchema = v.object({
  sha256s: v.array(v.pipe(v.string(), v.nonEmpty())),
});

export const findFilesBySha256 = createServerFn({ method: "GET" })
  .inputValidator(findFilesBySha256InputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    return db
      .select({
        id: file.id,
        sha256: file.sha256,
        status: file.status,
      })
      .from(file)
      .where(
        and(
          eq(file.topicId, context.topic.id),
          inArray(file.sha256, data.sha256s)
        )
      );
  });
