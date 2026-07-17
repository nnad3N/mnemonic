import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";

import { file, topic } from "@/db/schema";
import type { DbKit } from "@/lib/db-kit";
import { dbKit } from "@/lib/db-kit";
import type { Kits, ServerFnError } from "@/lib/kit";
import { Kit, toServerFnError } from "@/lib/kit";
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

const deleteTopicFn = Kit.gen(async function* (ctx: DeleteThreadCtx, input: DeleteTopicInput) {
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
    ctx.db.run((db) => db.delete(file).where(eq(file.topicId, input.topicId))),
    ctx.db.run((db) => db.delete(topic).where(eq(topic.id, input.topicId))),
    ...threads.map(async (thread) => ctx.memory.deleteThread({ threadId: thread.id })),
  ]);

  return Result.ok({ id: input.topicId });
});

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) => {
    const result = await Kit.get(memoryKit).deleteThread({
      threadId: context.thread.id,
    });

    if (result.isErr()) {
      throw toServerFnError.serverError("Failed to delete conversation");
    }

    return { id: context.thread.id };
  });

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
