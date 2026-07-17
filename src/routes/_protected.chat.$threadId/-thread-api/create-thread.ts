import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { nanoid } from "nanoid";
import * as v from "valibot";

import { topic } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import type { Kits, ServerFnError } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { createSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";

type CreateTopicCtx = Kits<[DbKit, MemoryKit]>;

type CreateTopicInput = {
  conversationTitle: string;
  topicTitle: string;
  userId: SafeId<"user">;
};

const createTopicFn = Kit.gen(async function* (ctx: CreateTopicCtx, input: CreateTopicInput) {
  const topicId = createSafeId<"topic">();

  yield* await ctx.db.run((db) =>
    db.insert(topic).values({
      id: topicId,
      title: input.topicTitle,
      userId: input.userId,
    }),
  );

  const now = new Date();
  const thread = yield* await ctx.memory.saveThread({
    thread: {
      id: nanoid(),
      resourceId: topicId,
      title: input.conversationTitle,
      createdAt: now,
      updatedAt: now,
    },
  });

  return Result.ok({ id: thread.id });
});

const createTopicCtx = Kit.createContext(dbKit, memoryKit);

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
      conversationTitle: v.pipe(v.string(), v.nonEmpty()),
      topicTitle: v.pipe(v.string(), v.nonEmpty()),
    }),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      createTopicFn(createTopicCtx, {
        conversationTitle: data.conversationTitle,
        topicTitle: data.topicTitle,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to create topic"),
        MemoryError: () => toServerFnError.serverError("Failed to create topic conversation"),
      }),
    ),
  );

export const createTopicConversation = createServerFn({ method: "POST" })
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
