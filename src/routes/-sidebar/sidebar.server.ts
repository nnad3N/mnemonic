import type { StorageThreadType } from "@mastra/core/memory";
import { Result } from "better-result";

import type { DbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit.server";
import { getResourceId } from "@/lib/middleware/resolve-thread.server";
import type { SafeId } from "@/lib/safe-id";
import { deleteConversationFn } from "@/routes/_protected.chat.$threadId/-thread-api/thread.server";

export type SidebarThread = {
  id: string;
  title: string;
  updatedAt: string;
};

const CONVERSATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const toSidebarThread = (thread: StorageThreadType): SidebarThread => ({
  id: thread.id,
  title: thread.title ?? "",
  updatedAt: thread.updatedAt.toISOString(),
});

const getExpiredThreads = (threads: StorageThreadType[]) => {
  const expiresBefore = Temporal.Now.instant().subtract({
    milliseconds: CONVERSATION_RETENTION_MS,
  });

  return threads.filter(
    (thread) => Temporal.Instant.compare(thread.updatedAt.toTemporalInstant(), expiresBefore) < 0,
  );
};

type SidebarCtx = Kits<[DbKit, MemoryKit]>;

type ListSidebarConversationsInput = {
  userId: SafeId<"user">;
};

export const listSidebarConversationsFn = Kit.gen(async function* (
  ctx: SidebarCtx,
  input: ListSidebarConversationsInput,
) {
  const oldestThreads = yield* await ctx.memory.listThreads({
    filter: { resourceId: getResourceId({ topicId: undefined, userId: input.userId }) },
    orderBy: { direction: "ASC", field: "updatedAt" },
    page: 0,
    perPage: false,
  });

  const expiredThreads = getExpiredThreads(oldestThreads.threads);
  yield* await Kit.promiseAll(
    expiredThreads.map(async (thread) => deleteConversationFn(ctx, { threadId: thread.id })),
  );

  const conversations = yield* await ctx.memory.listThreads({
    filter: { resourceId: getResourceId({ topicId: undefined, userId: input.userId }) },
    orderBy: { direction: "DESC", field: "updatedAt" },
    page: 0,
    perPage: false,
  });

  return Result.ok(conversations.threads.map(toSidebarThread));
});
