import { Result } from "better-result";
import { and, desc, eq } from "drizzle-orm";

import { file } from "@/db/schema.server";
import { ilike } from "@/db/sql.server";
import type { DbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit.server";
import type { SafeId } from "@/lib/safe-id";
import { rawId, toSafeId } from "@/lib/safe-id";
import { matchesQuery } from "@/lib/string-match";

export type MentionQueryType = "file" | "thread" | "topic";

export const MENTIONS_QUERY_LIMIT = 20;

type MentionItem = {
  displayName: string;
  id: string;
  type: MentionQueryType;
};

const buildFileMentionsWhereClause = (topicId: SafeId<"topic">, query: string | undefined) => {
  if (query === undefined) {
    return eq(file.topicId, topicId);
  }

  return and(eq(file.topicId, topicId), ilike(file.displayName, query));
};

type MentionsCtx = Kits<[DbKit, MemoryKit]>;

type GetMentionsInput = {
  query: string | undefined;
  resourceId: string;
  userId: SafeId<"user">;
};

export const getMentionsFn = Kit.gen(async function* (ctx: MentionsCtx, input: GetMentionsInput) {
  const ownedTopic = yield* await ctx.db.run((db) =>
    db.query.topic.findFirst({
      columns: { id: true },
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"topic">(input.resourceId),
        userId: input.userId,
      },
    }),
  );

  if (!ownedTopic) {
    return Result.ok([]);
  }

  const [fileMentions, threads] = yield* await Kit.promiseAll([
    ctx.db.run((db) =>
      db
        .select({
          id: file.id,
          displayName: file.displayName,
        })
        .from(file)
        .where(buildFileMentionsWhereClause(ownedTopic.id, input.query))
        .orderBy(desc(file.createdAt))
        .limit(MENTIONS_QUERY_LIMIT),
    ),
    ctx.memory.listThreads({
      filter: { resourceId: ownedTopic.id },
      orderBy: { direction: "DESC", field: "updatedAt" },
      page: 0,
      perPage: false,
    }),
  ]);

  const mentions: MentionItem[] = fileMentions.map((mention) => ({
    ...mention,
    type: "file",
  }));

  for (const thread of threads.threads) {
    const title = thread.title ?? "";

    if (matchesQuery(title, input.query) && mentions.length < MENTIONS_QUERY_LIMIT) {
      mentions.push({
        displayName: title,
        id: thread.id,
        type: "thread",
      });
    }
  }

  return Result.ok(mentions);
});

type GetMentionByIdInput = {
  id: string;
  type: MentionQueryType;
  userId: SafeId<"user">;
};

export const getMentionByIdFn = Kit.gen(async function* (
  ctx: MentionsCtx,
  input: GetMentionByIdInput,
) {
  switch (input.type) {
    case "file": {
      const ownedFile = yield* await ctx.db.run((db) =>
        db.query.file.findFirst({
          columns: {
            displayName: true,
            id: true,
            status: true,
          },
          where: {
            // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
            id: toSafeId<"file">(input.id),
            userId: input.userId,
          },
        }),
      );

      return Result.ok(
        ownedFile
          ? {
              displayName: ownedFile.displayName,
              id: rawId(ownedFile.id),
              status: ownedFile.status,
            }
          : null,
      );
    }
    case "topic": {
      const ownedTopic = yield* await ctx.db.run((db) =>
        db.query.topic.findFirst({
          columns: {
            id: true,
            title: true,
          },
          where: {
            // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
            id: toSafeId<"topic">(input.id),
            userId: input.userId,
          },
        }),
      );

      return Result.ok(
        ownedTopic
          ? {
              displayName: ownedTopic.title,
              id: rawId(ownedTopic.id),
              status: "ready" as const,
            }
          : null,
      );
    }
    case "thread": {
      const thread = yield* await ctx.memory.getThreadById({ threadId: input.id });

      if (!thread) {
        return Result.ok(null);
      }

      if (thread.resourceId !== input.userId) {
        const ownedTopic = yield* await ctx.db.run((db) =>
          db.query.topic.findFirst({
            columns: { id: true },
            where: {
              // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
              id: toSafeId<"topic">(thread.resourceId),
              userId: input.userId,
            },
          }),
        );

        if (!ownedTopic) {
          return Result.ok(null);
        }
      }

      return Result.ok({
        displayName: thread.title ?? "",
        id: thread.id,
        status: "ready" as const,
      });
    }
  }
});
