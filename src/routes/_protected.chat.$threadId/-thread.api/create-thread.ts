import { createServerFn } from "@tanstack/react-start";
import { nanoid } from "nanoid";
import * as v from "valibot";

import { db } from "@/db";
import { topic } from "@/db/schema";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { getMemoryStore } from "@/mastra/memory";

export const createConversation = createServerFn({ method: "POST" })
  .inputValidator(
    v.object({
      title: v.pipe(v.string(), v.nonEmpty()),
    })
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const memoryStore = await getMemoryStore();
    const now = new Date();
    const thread = await memoryStore.saveThread({
      thread: {
        id: nanoid(),
        resourceId: context.user.id,
        title: data.title,
        createdAt: now,
        updatedAt: now,
      },
    });

    return {
      id: thread.id,
    };
  });

export const createTopic = createServerFn({ method: "POST" })
  .inputValidator(
    v.object({
      conversationTitle: v.pipe(v.string(), v.nonEmpty()),
      topicTitle: v.pipe(v.string(), v.nonEmpty()),
    })
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const topicId = nanoid();
    await db.insert(topic).values({
      id: topicId,
      userId: context.user.id,
      title: data.topicTitle,
    });

    const memoryStore = await getMemoryStore();
    const now = new Date();
    const thread = await memoryStore.saveThread({
      thread: {
        id: nanoid(),
        resourceId: topicId,
        title: data.conversationTitle,
        createdAt: now,
        updatedAt: now,
      },
    });

    return {
      id: thread.id,
    };
  });
