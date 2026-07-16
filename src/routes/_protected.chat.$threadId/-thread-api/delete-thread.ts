import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";

import { file, topic } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { MemoryKit } from "@/lib/memory-kit";
import {
  threadAccessMiddleware,
  topicAccessMiddleware,
} from "@/lib/middleware/assert-thread-access";
import { s3Kit } from "@/lib/s3";
import type { S3Kit } from "@/lib/s3";
import type { SafeId } from "@/lib/safe-id";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/file-rag-config";
import { pgVector } from "@/mastra/storage";

type DeleteThreadCtx = Kits<[DbKit, S3Kit, MemoryKit]>;

type DeleteTopicInput = {
  topicId: SafeId<"topic">;
};

const deleteTopicFn = Kit.gen(async function* (
  ctx: DeleteThreadCtx,
  input: DeleteTopicInput
) {
  const [filesResult, threadsResult] = await Promise.all([
    ctx.db.run((db) =>
      db.query.file.findMany({
        where: { topicId: input.topicId },
        columns: { s3Key: true },
      })
    ),
    ctx.memory.listThreads({
      filter: { resourceId: input.topicId },
      page: 0,
      perPage: false,
    }),
  ]);
  const files = yield* filesResult;
  const { threads } = yield* threadsResult;

  const results = await Promise.all([
    ctx.s3.deleteObjects({
      keys: files.map((row) => row.s3Key),
    }),
    Result.tryPromise(async () =>
      pgVector.deleteVectors({
        indexName: FILE_EMBEDDINGS_INDEX,
        filter: { topicId: input.topicId },
      })
    ),
    ctx.db.run((db) => db.delete(file).where(eq(file.topicId, input.topicId))),
    ctx.db.run((db) => db.delete(topic).where(eq(topic.id, input.topicId))),
    ...threads.map(async (thread) =>
      ctx.memory.deleteThread({ threadId: thread.id })
    ),
  ]);

  for (const result of results) {
    yield* result;
  }

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

const deleteThreadCtx = Kit.createContext(dbKit, s3Kit, memoryKit);

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([topicAccessMiddleware])
  .handler(async ({ context }) => {
    const topicId = context.topic.id;
    const input = { topicId };

    const defaultError = () =>
      toServerFnError.serverError("Failed to delete topic");

    return Kit.serverFn(deleteTopicFn, {
      DatabaseError: defaultError,
      MemoryError: defaultError,
      S3Error: defaultError,
      UnhandledException: defaultError,
    })(deleteThreadCtx, input);
  });
