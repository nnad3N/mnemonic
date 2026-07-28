import { convertMessages } from "@mastra/core/agent";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import * as v from "valibot";

import { dbKit, type DbKit } from "@/lib/db-kit";
import type { Kits, ServerFnError } from "@/lib/kit";
import { Kit, toServerFnError } from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { memoryKit } from "@/lib/memory-kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { toSafeId, type SafeId } from "@/lib/safe-id";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";
import { getChatAgentId, uiMessageSchema } from "@/routes/api/chat";

const saveAbortedMessagesInputSchema = v.object({
  threadId: v.pipe(v.string(), v.nanoid()),
  deleteIds: v.array(v.pipe(v.string(), v.nonEmpty())),
  add: v.array(uiMessageSchema),
});

type SaveAbortedMessagesCtx = Kits<[DbKit, MemoryKit]>;

type SaveAbortedMessagesInput = {
  add: ThreadUIMessage[];
  threadId: string;
  userId: SafeId<"user">;
  deleteIds: string[];
  resourceId: string;
};

const saveAbortedMessagesFn = Kit.gen(async function* (
  ctx: SaveAbortedMessagesCtx,
  input: SaveAbortedMessagesInput,
) {
  const topic = yield* await ctx.db.run((db) =>
    db.query.topic.findFirst({
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"topic">(input.resourceId),
        userId: input.userId,
      },
    }),
  );

  const agentId = getChatAgentId({ topicId: topic?.id });

  if (input.deleteIds.length > 0) {
    yield* await ctx.memory.deleteMessages({
      agentId,
      messageIds: input.deleteIds,
    });
  }

  if (input.add.length > 0) {
    yield* await ctx.memory.saveMessages({
      agentId,
      messages: convertMessages(input.add)
        .to("Mastra.V2")
        .map((message) => ({
          ...message,
          resourceId: input.resourceId,
          threadId: input.threadId,
        })),
    });
  }

  return Result.ok();
});

const saveAbortedMessagesCtx = Kit.createContext(dbKit, memoryKit);

export const saveAbortedMessages = createServerFn({ method: "POST" })
  .validator(saveAbortedMessagesInputSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      saveAbortedMessagesFn(saveAbortedMessagesCtx, {
        userId: context.user.id,
        resourceId: context.thread.resourceId,
        threadId: context.thread.id,
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        add: data.add as ThreadUIMessage[],
        deleteIds: data.deleteIds,
      }),
    ).throws<ServerFnError>(() => toServerFnError.serverError("Failed to save aborted messages")),
  );
