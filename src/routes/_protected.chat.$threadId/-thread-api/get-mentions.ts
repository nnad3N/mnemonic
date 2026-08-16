import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";

import { file } from "@/db/schema";
import { ilike } from "@/db/sql";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import type { SafeId } from "@/lib/safe-id";
import { rawId, toSafeId } from "@/lib/safe-id";
import { matchesQuery } from "@/lib/string-match";

import type { MentionQueryType } from "./query-keys";
import { threadKeys } from "./query-keys";

export const MENTIONS_QUERY_LIMIT = 20;

type MentionItem = {
  displayName: string;
  id: string;
  type: MentionQueryType;
};

const buildFileMentionsWhereClause = (topicId: SafeId<"topic">, query: string) => {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return eq(file.topicId, topicId);
  }

  return and(eq(file.topicId, topicId), ilike(file.displayName, trimmedQuery));
};

const getMentionsInputSchema = v.object({
  resourceId: v.pipe(v.string(), v.nonEmpty()),
  query: v.optional(v.string(), ""),
});

const getMentionByIdInputSchema = v.object({
  id: v.pipe(v.string(), v.nanoid()),
  type: v.picklist(["file", "thread", "topic"]),
});

type MentionsCtx = Kits<[DbKit, MemoryKit]>;

type GetMentionsInput = {
  query: string;
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

const getMentionByIdFn = Kit.gen(async function* (ctx: MentionsCtx, input: GetMentionByIdInput) {
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

const mentionsCtx = Kit.createContext(dbKit, memoryKit);

export const getMentions = createServerFn({ method: "GET" })
  .validator(getMentionsInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      getMentionsFn(mentionsCtx, {
        query: data.query,
        resourceId: data.resourceId,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load mentions"),
        MemoryError: () => toServerFnError.serverError("Failed to load conversation mentions"),
      }),
    ),
  );

export type MentionsQueryParams = {
  resourceId: string;
  query?: string;
};

export const mentionsQuery = ({ resourceId, query = "" }: MentionsQueryParams) =>
  queryOptions({
    queryKey: [...threadKeys.mentions(resourceId), { query }] as const,
    queryFn: async () =>
      getMentions({
        data: { query, resourceId },
      }),
    placeholderData: keepPreviousData,
  });

export const getMentionById = createServerFn({ method: "GET" })
  .validator(getMentionByIdInputSchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      getMentionByIdFn(mentionsCtx, {
        id: data.id,
        type: data.type,
        userId: context.user.id,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to load mention"),
        MemoryError: () => toServerFnError.serverError("Failed to load conversation mention"),
      }),
    ),
  );

type GetMentionByIdParams = {
  id: string;
  type: MentionQueryType;
};

export const mentionByIdQuery = ({ id, type }: GetMentionByIdParams) =>
  queryOptions({
    // without this the optimistic update for file upload might be discarded
    refetchOnMount: false,
    queryFn: async () =>
      getMentionById({
        data: { id, type },
      }),
    queryKey: threadKeys.mention(type, id),
  });
