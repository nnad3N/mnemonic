import { Result, TaggedError } from "better-result";

import type { DbKit } from "@/lib/db-kit.server";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit.server";
import type { SafeId } from "@/lib/safe-id";
import { toSafeId } from "@/lib/safe-id";
import { getMnemonicAgentId } from "@/mastra/agents/id.server";

class ThreadNotFoundError extends TaggedError("ThreadNotFoundError")<{
  message: string;
}> {}

export const getResourceId = (input: {
  topicId: SafeId<"topic"> | undefined;
  userId: SafeId<"user">;
}): string => input.topicId ?? input.userId;

type ResolveThreadInput = {
  threadId: string;
  userId: SafeId<"user">;
};

type ResolveThreadCtx = Kits<[DbKit, MemoryKit]>;

export const resolveThread = Kit.gen(async function* (
  ctx: ResolveThreadCtx,
  input: ResolveThreadInput,
) {
  const thread = yield* await ctx.memory.getThreadById({ threadId: input.threadId });

  if (!thread) {
    return Result.err(new ThreadNotFoundError({ message: "Thread not found" }));
  }

  if (thread.resourceId === input.userId) {
    return Result.ok({
      agentId: getMnemonicAgentId({ topicId: undefined }),
      resourceId: getResourceId({ topicId: undefined, userId: input.userId }),
      thread,
      topicId: undefined,
    });
  }

  const topic = yield* await ctx.db.run((db) =>
    db.query.topic.findFirst({
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"topic">(thread.resourceId),
        userId: input.userId,
      },
      columns: { id: true },
    }),
  );

  if (!topic) {
    return Result.err(new ThreadNotFoundError({ message: "Thread not found" }));
  }

  return Result.ok({
    agentId: getMnemonicAgentId({ topicId: topic.id }),
    resourceId: getResourceId({ topicId: topic.id, userId: input.userId }),
    thread,
    topicId: topic.id,
  });
});
