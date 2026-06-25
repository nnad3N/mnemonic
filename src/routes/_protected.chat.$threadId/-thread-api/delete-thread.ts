import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { artifact, topic } from "@/db/schema";
import {
  threadAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";
import { deleteObjects } from "@/lib/s3";
import { ARTIFACT_EMBEDDINGS_INDEX } from "@/mastra/artifact-rag-config";
import { getAgentMemory, getMemoryStore } from "@/mastra/memory";
import { pgVector } from "@/mastra/storage";

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) => {
    const memory = await getAgentMemory();
    await memory.deleteThread(context.thread.id);

    return { id: context.thread.id };
  });

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const topicId = context.topic.id;

    const artifacts = await db.query.artifact.findMany({
      where: { topicId },
      columns: { s3Key: true },
    });

    const s3Result = await deleteObjects({
      keys: artifacts.map((row) => row.s3Key),
    });

    if (Result.isError(s3Result)) {
      throw s3Result.error;
    }

    await pgVector.deleteVectors({
      indexName: ARTIFACT_EMBEDDINGS_INDEX,
      filter: { topicId },
    });

    await db.delete(artifact).where(eq(artifact.topicId, topicId));

    const [memoryStore, memory] = await Promise.all([
      getMemoryStore(),
      getAgentMemory(),
    ]);
    const { threads } = await memoryStore.listThreads({
      filter: { resourceId: topicId },
      page: 0,
      perPage: false,
    });
    await Promise.all(
      threads.map(async (thread) => memory.deleteThread(thread.id))
    );

    await db.delete(topic).where(eq(topic.id, topicId));

    return { id: topicId };
  });
