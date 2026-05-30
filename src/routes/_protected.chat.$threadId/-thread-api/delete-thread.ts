import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { topic } from "@/db/schema";
import {
  threadAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";
import { getMemoryStore } from "@/mastra/memory";

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) => {
    const memoryStore = await getMemoryStore();
    await memoryStore.deleteThread({ threadId: context.thread.id });

    return { id: context.thread.id };
  });

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const memoryStore = await getMemoryStore();
    const { threads } = await memoryStore.listThreads({
      filter: { resourceId: context.topic.id },
      page: 0,
      perPage: false,
    });

    await Promise.all(
      threads.map(async (thread) =>
        memoryStore.deleteThread({ threadId: thread.id })
      )
    );

    await db.delete(topic).where(eq(topic.id, context.topic.id));

    return { id: context.topic.id };
  });
