import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { nanoid } from "nanoid";
import * as v from "valibot";

import { topic } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { createSafeId } from "@/lib/safe-id";

export const createConversation = createServerFn({ method: "POST" })
  .validator(
    v.object({
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const now = new Date();
    const result = await Kit.get(memoryKit).saveThread({
      thread: {
        id: nanoid(),
        resourceId: context.user.id,
        title: data.title,
        createdAt: now,
        updatedAt: now,
      },
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to create conversation");
    }

    return {
      id: result.value.id,
    };
  });

export const createTopic = createServerFn({ method: "POST" })
  .validator(
    v.object({
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const topicId = createSafeId<"topic">();
    const result = await Kit.get(dbKit).run((db) =>
      db.insert(topic).values({
        id: topicId,
        title: data.title,
        userId: context.user.id,
      }),
    );

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to create topic");
    }

    return { id: topicId };
  });

export const createTopicThread = createServerFn({ method: "POST" })
  .validator(
    v.object({
      title: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([topicAccessMiddleware])
  .handler(async ({ context, data }) => {
    const now = new Date();
    const result = await Kit.get(memoryKit).saveThread({
      thread: {
        id: nanoid(),
        resourceId: context.topic.id,
        title: data.title,
        createdAt: now,
        updatedAt: now,
      },
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to create topic conversation");
    }

    return { id: result.value.id };
  });
