import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { topic } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import {
  threadAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";

export const renameConversation = createServerFn({ method: "POST" })
  .validator(
    v.object({
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    const result = await Kit.get(memoryKit).updateThread({
      id: context.thread.id,
      metadata: context.thread.metadata ?? {},
      title: data.title,
    });

    if (Result.isError(result)) {
      throw Kit.toServerFnError.serverError("Failed to rename conversation");
    }

    return { id: context.thread.id };
  });

export const renameTopic = createServerFn({ method: "POST" })
  .validator(
    v.object({
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    const result = await Kit.get(dbKit).run((db) =>
      db.update(topic).set({ title: data.title }).where(eq(topic.id, context.topic.id)),
    );

    if (Result.isError(result)) {
      throw Kit.toServerFnError.serverError("Failed to rename topic");
    }

    return { id: context.topic.id };
  });
