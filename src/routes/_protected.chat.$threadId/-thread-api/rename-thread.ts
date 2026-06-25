import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "@/db";
import { topic } from "@/db/schema";
import {
  threadAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";
import { getMemoryStore } from "@/mastra/memory";

export const renameConversation = createServerFn({ method: "POST" })
  .inputValidator(
    v.object({
      threadId: v.pipe(v.string(), v.nanoid()),
      title: v.pipe(v.string(), v.nonEmpty()),
    })
  )
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    const memoryStore = await getMemoryStore();
    await memoryStore.updateThread({
      id: context.thread.id,
      metadata: context.thread.metadata ?? {},
      title: data.title,
    });

    return { id: context.thread.id };
  });

export const renameTopic = createServerFn({ method: "POST" })
  .inputValidator(
    v.object({
      topicId: v.pipe(v.string(), v.nanoid()),
      title: v.pipe(v.string(), v.nonEmpty()),
    })
  )
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    await db
      .update(topic)
      .set({ title: data.title })
      .where(eq(topic.id, context.topic.id));

    return { id: context.topic.id };
  });
