import { notFound } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import * as v from "valibot";

import { db } from "@/db";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { toSafeId } from "@/lib/safe-id";
import { getMemoryStore } from "@/mastra/memory";

const threadAccessInputSchema = v.looseObject({
  threadId: v.pipe(v.string(), v.nanoid()),
});

type ThreadAccessInputSchema = v.InferOutput<typeof threadAccessInputSchema>;

// Return `unknown` from access middleware validators intentionally: the typed
// parameter keeps the ID required at call sites, but prevents middleware input
// from being merged into handler `data`. Later server-fn `v.object(...)`
// validators strip unknown keys at runtime, so handlers should read these IDs
// from context instead.
export const threadAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .inputValidator((data: ThreadAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { threadId } = v.parse(threadAccessInputSchema, data);
    const memoryStore = await getMemoryStore();
    const thread = await memoryStore.getThreadById({ threadId });

    if (thread === null) {
      throw notFound();
    }

    if (thread.resourceId !== context.user.id) {
      const ownedTopic = await db.query.topic.findFirst({
        where: {
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
          id: toSafeId<"topic">(thread.resourceId),
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

const topicAccessInputSchema = v.looseObject({
  topicId: v.pipe(v.string(), v.nanoid()),
});

type TopicAccessInputSchema = v.InferOutput<typeof topicAccessInputSchema>;

export const topicAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .inputValidator((data: TopicAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { topicId } = v.parse(topicAccessInputSchema, data);
    const ownedTopic = await db.query.topic.findFirst({
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"topic">(topicId),
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

const resourceAccessInputSchema = v.looseObject({
  resourceId: v.pipe(v.string(), v.nanoid()),
});

type ResourceAccessInputSchema = v.InferOutput<
  typeof resourceAccessInputSchema
>;

export const resourceAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .inputValidator((data: ResourceAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { resourceId } = v.parse(resourceAccessInputSchema, data);
    const ownedResource = await db.query.resource.findFirst({
      columns: {
        displayName: true,
        id: true,
        s3Key: true,
        status: true,
        topicId: true,
      },
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"resource">(resourceId),
        userId: context.user.id,
      },
    });

    if (!ownedResource) {
      throw notFound();
    }

    return next({
      context: {
        resource: ownedResource,
        topicId: ownedResource.topicId,
      },
    });
  });
