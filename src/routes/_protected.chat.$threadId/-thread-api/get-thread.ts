import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { createServerFn } from "@tanstack/react-start";
import type { TsrSerializable } from "@tanstack/router-core";
import { matchError, Result } from "better-result";

import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import type { Kits, ServerFnError } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import type { SafeId } from "@/lib/safe-id";
import { toSafeId } from "@/lib/safe-id";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

type GetThreadCtx = Kits<[DbKit, MemoryKit]>;

type GetThreadInput = {
  resourceId: string;
  threadId: string;
  userId: SafeId<"user">;
};

const getThreadFn = Kit.gen(async function* (ctx: GetThreadCtx, input: GetThreadInput) {
  const [{ messages }, topic] = yield* await Kit.promiseAll([
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
    Kit.run(async () =>
      getThreadFn(getThreadCtx, {
        resourceId: context.thread.resourceId,
        threadId: context.thread.id,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load thread topic"),
        MemoryError: () => toServerFnError.serverError("Failed to load thread messages"),
      }),
    ),
  );
