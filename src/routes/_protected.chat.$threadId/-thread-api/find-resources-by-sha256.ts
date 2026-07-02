import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { resource } from "@/db/schema";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const findResourcesBySha256InputSchema = v.object({
  sha256s: v.array(v.pipe(v.string(), v.nonEmpty())),
});

export const findResourcesBySha256 = createServerFn({ method: "GET" })
  .inputValidator(findResourcesBySha256InputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    return db
      .select({
        id: resource.id,
        sha256: resource.sha256,
        status: resource.status,
      })
      .from(resource)
      .where(
        and(
          eq(resource.topicId, context.topic.id),
          inArray(resource.sha256, data.sha256s)
        )
      );
  });
