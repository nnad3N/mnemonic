import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "drizzle-orm";
import * as v from "valibot";

import { file } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";

const findFilesBySha256InputSchema = v.object({
  sha256s: v.array(v.pipe(v.string(), v.nonEmpty())),
});

export const findFilesBySha256 = createServerFn({ method: "GET" })
  .validator(findFilesBySha256InputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      Kit.get(dbKit).run((db) =>
        db
          .select({
            id: file.id,
            sha256: file.sha256,
            status: file.status,
          })
          .from(file)
          .where(and(eq(file.topicId, context.topic.id), inArray(file.sha256, data.sha256s))),
      ),
    ).throws(() => toServerFnError.serverError("Failed to find matching files")),
  );
