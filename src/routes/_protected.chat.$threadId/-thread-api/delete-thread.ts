import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { eq, inArray } from "drizzle-orm";

import { file, threadSettings, topic } from "@/db/schema";
import type { DbKit } from "@/lib/db-kit";
import { dbKit } from "@/lib/db-kit";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { memoryKit } from "@/lib/memory-kit";
import {
  threadAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";
import type { S3Kit } from "@/lib/s3-kit";
import { s3Kit } from "@/lib/s3-kit";
import type { SafeId } from "@/lib/safe-id";
import type { VectorKit } from "@/lib/vector-kit";
import { vectorKit } from "@/lib/vector-kit";

type DeleteThreadCtx = Kits<[DbKit, S3Kit, MemoryKit, VectorKit]>;

type DeleteTopicInput = {
  topicId: SafeId<"topic">;
};

export const deleteTopicFn = Kit.gen(async function* (
  ctx: DeleteThreadCtx,
  input: DeleteTopicInput,
) {
  const [files, { threads }] = yield* await Kit.promiseAll([
    ctx.db.run((db) =>
      db.query.file.findMany({
        where: { topicId: input.topicId },
        columns: { s3Key: true },
      }),
    ),
    ctx.memory.listThreads({
      filter: { resourceId: input.topicId },
      page: 0,
      perPage: false,
    }),
  ]);
  yield* await Kit.promiseAll([
    ctx.s3.deleteObjects({
      keys: files.map((row) => row.s3Key),
    }),
    ctx.vector.deleteVectors({
      filter: { topicId: input.topicId },
    }),
    ...threads.map(async (thread) => ctx.memory.deleteThread({ threadId: thread.id })),
  ]);
  // Keep durable rows until external deletes succeed so a failed S3/vector/memory
  // call can be retried.
  yield* await ctx.db.transaction(async (tx) =>
    Promise.all([
      tx.delete(file).where(eq(file.topicId, input.topicId)),
      tx.delete(threadSettings).where(
        inArray(
          threadSettings.threadId,
          threads.map((thread) => thread.id),
        ),
      ),
      tx.delete(topic).where(eq(topic.id, input.topicId)),
    ]),
  );

  return Result.ok({ id: input.topicId });
});

type DeleteConversationCtx = Kits<[DbKit, MemoryKit]>;

type DeleteConversationInput = {
  threadId: string;
};

const deleteConversationFn = Kit.gen(async function* (
  ctx: DeleteConversationCtx,
  input: DeleteConversationInput,
) {
  yield* await ctx.memory.deleteThread({
    threadId: input.threadId,
  });

  yield* await ctx.db.run((db) =>
    db.delete(threadSettings).where(eq(threadSettings.threadId, input.threadId)),
  );

  return Result.ok({ id: input.threadId });
});

const deleteConversationCtx = Kit.createContext(dbKit, memoryKit);

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      deleteConversationFn(deleteConversationCtx, {
        threadId: context.thread.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to delete conversation"),
        MemoryError: () => toServerFnError.serverError("Failed to delete conversation"),
      }),
    ),
  );

const deleteThreadCtx = Kit.createContext(dbKit, s3Kit, memoryKit, vectorKit);

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const topicId = context.topic.id;
    const input = { topicId };

    return Kit.run(async () => deleteTopicFn(deleteThreadCtx, input)).throws<ServerFnError>(() =>
      toServerFnError.serverError("Failed to delete topic"),
    );
  });
