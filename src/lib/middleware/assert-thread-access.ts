import { notFound } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import * as v from "valibot";

import { db } from "@/db";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { getMemoryStore } from "@/mastra/memory";

export const threadAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .inputValidator((data) =>
    v.parse(
      v.looseObject({
        threadId: v.pipe(v.string(), v.nanoid()),
      }),
      data
    )
  )
  .server(async ({ context, data, next }) => {
    const memoryStore = await getMemoryStore();
    const thread = await memoryStore.getThreadById({ threadId: data.threadId });

    if (thread === null) {
      throw notFound();
    }

    if (thread.resourceId !== context.user.id) {
      const ownedTopic = await db.query.topic.findFirst({
        where: {
          id: thread.resourceId,
          userId: context.user.id,
        },
        columns: { id: true },
      });

      if (!ownedTopic) {
        throw notFound();
      }
    }

    return next({
      context: {
        thread,
      },
    });
  });

export const topicAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .inputValidator((data) =>
    v.parse(
      v.looseObject({
        topicId: v.pipe(v.string(), v.nanoid()),
      }),
      data
    )
  )
  .server(async ({ context, data, next }) => {
    const ownedTopic = await db.query.topic.findFirst({
      where: {
        id: data.topicId,
        userId: context.user.id,
      },
      columns: { id: true },
    });

    if (!ownedTopic) {
      throw notFound();
    }

    return next({
      context: {
        topic: ownedTopic,
      },
    });
  });
