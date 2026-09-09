import { Result } from "better-result";
import { and, desc, eq, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { file, note } from "@/db/schema.server";
import { ilike } from "@/db/sql.server";
import type { DbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit.server";
import { getResourceId, resolveThread } from "@/lib/middleware/resolve-thread.server";
import type { SafeId } from "@/lib/safe-id";
import { rawId, toSafeId } from "@/lib/safe-id";
import { matchesQuery } from "@/lib/string-match";

export type MentionQueryType = "file" | "note" | "thread" | "topic";

export const MENTIONS_QUERY_LIMIT = 20;

type MentionItem = {
  displayName: string;
  id: string;
  type: MentionQueryType;
};

type MentionsCtx = Kits<[DbKit, MemoryKit]>;

type GetMentionsInput = {
  query: string | undefined;
  threadId: string;
  userId: SafeId<"user">;
};

export const getMentionsFn = Kit.gen(async function* (ctx: MentionsCtx, input: GetMentionsInput) {
  const { topicId } = yield* await resolveThread(ctx, {
    threadId: input.threadId,
    userId: input.userId,
  });

  const listNotes = async (scoped: SQL | undefined) =>
    ctx.db.run((db) =>
      db
        .select({
          id: note.id,
          displayName: note.title,
        })
        .from(note)
        .where(and(scoped, ilike(note.title, input.query)))
        .orderBy(desc(note.updatedAt))
        .limit(MENTIONS_QUERY_LIMIT),
    );

  if (!topicId) {
    const notes = yield* await listNotes(eq(note.threadId, input.threadId));

    return Result.ok(
      notes.map(
        (listed): MentionItem => ({
          displayName: listed.displayName,
          id: rawId(listed.id),
          type: "note",
        }),
      ),
    );
  }

  const [files, listedThreads, notes] = yield* await Kit.promiseAll([
    ctx.db.run((db) =>
      db
        .select({
          id: file.id,
          displayName: file.displayName,
        })
        .from(file)
        .where(and(eq(file.topicId, topicId), ilike(file.displayName, input.query)))
        .orderBy(desc(file.createdAt))
        .limit(MENTIONS_QUERY_LIMIT),
    ),
    ctx.memory.listThreads({
      filter: { resourceId: getResourceId({ topicId, userId: input.userId }) },
      orderBy: { direction: "DESC", field: "updatedAt" },
      page: 0,
      perPage: false,
    }),
    listNotes(or(eq(note.threadId, input.threadId), eq(note.topicId, topicId))),
  ]);

  const threads = listedThreads.threads;

  const mentions: MentionItem[] = [
    ...files.map((listed) => ({
      displayName: listed.displayName,
      id: rawId(listed.id),
      type: "file" as const,
    })),
    ...notes.map((listed) => ({
      displayName: listed.displayName,
      id: rawId(listed.id),
      type: "note" as const,
    })),
    ...threads
      .filter((thread) => matchesQuery(thread.title ?? "", input.query))
      .map((thread) => ({
        displayName: thread.title ?? "",
        id: thread.id,
        type: "thread" as const,
      })),
  ];

  return Result.ok(mentions.slice(0, MENTIONS_QUERY_LIMIT));
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

      if (!ownedFile) {
        return Result.err(toServerFnError.notFound("File not found"));
      }

      return Result.ok({
        displayName: ownedFile.displayName,
        id: rawId(ownedFile.id),
        status: ownedFile.status,
      });
    }
    case "note": {
      const ownedNote = yield* await ctx.db.run((db) =>
        db.query.note.findFirst({
          columns: {
            id: true,
            title: true,
          },
          where: {
            // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
            id: toSafeId<"note">(input.id),
            userId: input.userId,
          },
        }),
      );

      if (!ownedNote) {
        return Result.err(toServerFnError.notFound("Note not found"));
      }

      return Result.ok({
        displayName: ownedNote.title,
        id: rawId(ownedNote.id),
        status: "ready" as const,
      });
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

      if (!ownedTopic) {
        return Result.err(toServerFnError.notFound("Topic not found"));
      }

      return Result.ok({
        displayName: ownedTopic.title,
        id: rawId(ownedTopic.id),
        status: "ready" as const,
      });
    }
    case "thread": {
      const { thread } = yield* await resolveThread(ctx, {
        threadId: input.id,
        userId: input.userId,
      });

      return Result.ok({
        displayName: thread.title ?? "",
        id: thread.id,
        status: "ready" as const,
      });
    }
  }
});
