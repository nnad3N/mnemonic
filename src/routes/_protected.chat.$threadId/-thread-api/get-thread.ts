import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { TsrSerializable } from "@tanstack/router-core";
import { Result } from "better-result";

import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import type { SafeId } from "@/lib/safe-id";
import { toSafeId } from "@/lib/safe-id";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

type GetThreadCtx = Kits<[DbKit, MemoryKit]>;

type GetThreadInput = {
  resourceId: string;
  threadId: string;
  userId: SafeId<"user">;
};

const getThreadFn = Kit.gen(async function* (ctx: GetThreadCtx, input: GetThreadInput) {
  const [messagesResult, topicResult] = await Promise.all([
    ctx.memory.listMessages({
      threadId: input.threadId,
      page: 0,
      perPage: false,
    }),
    ctx.db.run((db) =>
      db.query.topic.findFirst({
        columns: { id: true },
        where: {
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
          id: toSafeId<"topic">(input.resourceId),
          userId: input.userId,
        },
      }),
    ),
  ]);

  const { messages } = yield* messagesResult;
  const topic = yield* topicResult;

  return Result.ok({
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    messages: toAISdkMessages(messages, {
      version: "v6",
    }) as (ThreadUIMessage & TsrSerializable)[],
    resourceId: input.resourceId,
    topicId: topic?.id,
  });
});

const getThreadCtx = Kit.createContext(dbKit, memoryKit);

export const getThread = createServerFn({ method: "GET" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.serverFn(getThreadFn, {
      DatabaseError: () => toServerFnError.serverError("Failed to load thread topic"),
      MemoryError: () => toServerFnError.serverError("Failed to load thread messages"),
    })(getThreadCtx, {
      resourceId: context.thread.resourceId,
      threadId: context.thread.id,
      userId: context.user.id,
    }),
  );

export const threadQuery = (threadId: string) =>
  queryOptions({
    queryFn: async () => {
      const data = await getThread({
        data: { threadId },
      });

      return {
        resourceId: data.resourceId,
        messages: data.messages as ThreadUIMessage[],
        topicId: data.topicId,
      };
    },
    queryKey: threadKeys.byId(threadId),
    staleTime: Infinity,
  });
