import { notFound } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import * as v from "valibot";

import { db } from "@/db";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
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
        id: topicId,
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

const artifactAccessInputSchema = v.looseObject({
  artifactId: v.pipe(v.string(), v.nanoid()),
});

type ArtifactAccessInputSchema = v.InferOutput<
  typeof artifactAccessInputSchema
>;

export const artifactAccessMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .inputValidator((data: ArtifactAccessInputSchema) => data as unknown)
  .server(async ({ context, data, next }) => {
    const { artifactId } = v.parse(artifactAccessInputSchema, data);
    const ownedArtifact = await db.query.artifact.findFirst({
      columns: {
        displayName: true,
        id: true,
        s3Key: true,
        status: true,
        topicId: true,
      },
      where: {
        id: artifactId,
        userId: context.user.id,
      },
    });

    if (!ownedArtifact) {
      throw notFound();
    }

    return next({
      context: {
        artifact: ownedArtifact,
        topicId: ownedArtifact.topicId,
      },
    });
  });
