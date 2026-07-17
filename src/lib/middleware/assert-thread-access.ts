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
  .validator((data: ThreadAccessInputSchema) => data as unknown)
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
  .validator((data: TopicAccessInputSchema) => data as unknown)
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

const fileAccessInputSchema = v.looseObject({
  fileId: v.pipe(v.string(), v.nanoid()),
});

type FileAccessInputSchema = v.InferOutput<typeof fileAccessInputSchema>;

export const fileAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .validator((data: FileAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { fileId } = v.parse(fileAccessInputSchema, data);
    const ownedFile = await db.query.file.findFirst({
      columns: {
        displayName: true,
        id: true,
        s3Key: true,
        status: true,
        topicId: true,
      },
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"file">(fileId),
        userId: context.user.id,
      },
    });

    if (!ownedFile) {
      throw notFound();
    }

    return next({
      context: {
        file: ownedFile,
        topicId: ownedFile.topicId,
      },
    });
  });
