import { matchError, Result } from "better-result";
import type { Result as ResultType } from "better-result";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { note, noteVersion } from "@/db/schema.server";
import type { NoteVersionAuthor } from "@/db/schema.server";
import { ilike } from "@/db/sql.server";
import type { DatabaseError, DbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import { hashText } from "@/lib/hash";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { MemoryError, MemoryKit } from "@/lib/memory-kit.server";
import { resolveThread } from "@/lib/middleware/resolve-thread.server";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";

type NoteCtx = Kits<[DbKit]>;
type ListNotesCtx = Kits<[DbKit, MemoryKit]>;
type AddNoteToTopicCtx = Kits<[DbKit, MemoryKit]>;

type NoteIdInput = {
  noteId: SafeId<"note">;
};

const readNote = Kit.gen(async function* (ctx: NoteCtx, input: NoteIdInput) {
  const note = yield* await ctx.db.run((db) =>
    db.query.note.findFirst({
      where: { id: input.noteId },
      columns: { id: true, threadId: true, title: true, topicId: true },
    }),
  );

  if (!note) {
    return Result.err(toServerFnError.notFound("Note not found"));
  }

  return Result.ok(note);
});

const readLatestVersion = Kit.gen(async function* (ctx: NoteCtx, input: NoteIdInput) {
  const latestVersion = yield* await ctx.db.run((db) =>
    db.query.noteVersion.findFirst({
      where: { noteId: input.noteId },
      columns: { author: true, content: true, contentHash: true, id: true, seq: true },
      orderBy: { seq: "desc" },
    }),
  );

  return Result.ok(latestVersion);
});

type CreateNoteInput = {
  threadId: string;
  title: string;
  userId: SafeId<"user">;
};

export const createNoteFn = Kit.gen(async function* (ctx: NoteCtx, input: CreateNoteInput) {
  const id = createSafeId<"note">();
  const contentHash = await hashText("");

  yield* await ctx.db.transaction(async (tx) => {
    await tx.insert(note).values({
      id,
      threadId: input.threadId,
      title: input.title,
      userId: input.userId,
    });

    await tx.insert(noteVersion).values({
      author: "user",
      content: "",
      contentHash,
      noteId: id,
      seq: 1,
    });
  });

  return Result.ok({ id });
});

type ListNotesInput = {
  page: number;
  pageSize: number;
  scope: NoteScope;
  search: string;
  userId: SafeId<"user">;
};

export type NoteScope = { id: string; type: "thread" } | { id: string; type: "topic" };

export type NoteListItem = {
  id: SafeId<"note">;
  lastAuthor: NoteVersionAuthor;
  title: string;
  updatedAt: Date;
};

export const listNotesFn = Kit.gen(async function* (ctx: ListNotesCtx, input: ListNotesInput) {
  const trimmedSearch = input.search.trim();

  const scopedToUser = (table: typeof note) => {
    const conditions = [
      eq(table.userId, input.userId),
      input.scope.type === "thread"
        ? eq(table.threadId, input.scope.id)
        : // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with the userId filter.
          eq(table.topicId, toSafeId<"topic">(input.scope.id)),
    ];

    if (trimmedSearch.length > 0) {
      conditions.push(ilike(table.title, trimmedSearch));
    }

    return sql.join(conditions, sql` and `);
  };

  const checkCanMoveToTopic = async (): Promise<
    ResultType<boolean, DatabaseError | MemoryError>
  > => {
    if (input.scope.type === "topic") {
      return Result.ok(false);
    }

    const thread = await resolveThread(ctx, {
      threadId: input.scope.id,
      userId: input.userId,
    });

    if (Result.isError(thread)) {
      return matchError(thread.error, {
        DatabaseError: (failure) => Result.err(failure),
        MemoryError: (failure) => Result.err(failure),
        ThreadNotFoundError: () => Result.ok(false),
      });
    }

    return Result.ok(thread.value.topicId !== undefined);
  };

  const [{ notes, totalCount }, canMoveToTopic] = yield* await Kit.promiseAll([
    ctx.db.run(async (db) => {
      const [rows, total] = await Promise.all([
        db.query.note.findMany({
          columns: { id: true, title: true, updatedAt: true },
          limit: input.pageSize,
          offset: (input.page - 1) * input.pageSize,
          orderBy: { updatedAt: "desc" },
          where: { RAW: (table) => scopedToUser(table) },
          with: {
            versions: {
              columns: { author: true },
              limit: 1,
              orderBy: { seq: "desc" },
            },
          },
        }),
        db.$count(note, scopedToUser(note)),
      ]);

      return { notes: rows, totalCount: total };
    }),
    checkCanMoveToTopic(),
  ]);

  return Result.ok({
    items: notes.map((listed) => ({
      id: listed.id,
      lastAuthor: listed.versions.at(0)?.author ?? "user",
      title: listed.title,
      updatedAt: listed.updatedAt,
    })),
    canMoveToTopic,
    totalCount,
  });
});

export const getNoteFn = Kit.gen(async function* (ctx: NoteCtx, input: NoteIdInput) {
  const [note, latest] = yield* await Kit.promiseAll([
    readNote(ctx, input),
    readLatestVersion(ctx, input),
  ]);

  if (!latest) {
    return Result.err(toServerFnError.notFound("Note not found"));
  }

  return Result.ok({
    content: latest.content,
    contentHash: latest.contentHash,
    id: note.id,
    isInTopic: note.topicId !== null,
    title: note.title,
  });
});

type SaveNoteBodyInput = NoteIdInput & {
  content: string;
};

export const saveNoteBodyFn = Kit.gen(async function* (ctx: NoteCtx, input: SaveNoteBodyInput) {
  const contentHash = await hashText(input.content);

  yield* await ctx.db.transaction(async (tx) => {
    const latestVersion = await tx.query.noteVersion.findFirst({
      where: { noteId: input.noteId },
      columns: { author: true, id: true, seq: true },
      orderBy: { seq: "desc" },
    });

    if (latestVersion?.author === "user") {
      await tx
        .update(noteVersion)
        .set({ content: input.content, contentHash })
        .where(eq(noteVersion.id, latestVersion.id));

      return;
    }

    await tx.insert(noteVersion).values({
      author: "user",
      content: input.content,
      contentHash,
      noteId: input.noteId,
      seq: (latestVersion?.seq ?? 0) + 1,
    });
  });

  return Result.ok({ contentHash });
});

type SaveNoteTitleInput = NoteIdInput & {
  title: string;
};

export const saveNoteTitleFn = Kit.gen(async function* (ctx: NoteCtx, input: SaveNoteTitleInput) {
  yield* await ctx.db.run((db) =>
    db.update(note).set({ title: input.title }).where(eq(note.id, input.noteId)),
  );

  return Result.ok({ id: input.noteId });
});

type AddNoteToTopicInput = NoteIdInput & {
  userId: SafeId<"user">;
};

export const addNoteToTopicFn = Kit.gen(async function* (
  ctx: AddNoteToTopicCtx,
  input: AddNoteToTopicInput,
) {
  const noteRow = yield* await readNote(ctx, input);

  if (!noteRow.threadId) {
    return Result.err(toServerFnError.badRequest("This note already lives in a topic"));
  }

  const thread = yield* await resolveThread(ctx, {
    threadId: noteRow.threadId,
    userId: input.userId,
  });

  if (!thread.topicId) {
    return Result.err(toServerFnError.badRequest("This thread has no topic"));
  }

  // Guarded on the thread still being set, so two concurrent moves cannot both take effect.
  yield* await ctx.db.run((db) =>
    db
      .update(note)
      .set({ threadId: null, topicId: thread.topicId })
      .where(and(eq(note.id, input.noteId), isNotNull(note.threadId))),
  );

  return Result.ok({ id: input.noteId });
});

export const deleteNoteFn = Kit.gen(async function* (ctx: NoteCtx, input: NoteIdInput) {
  yield* await ctx.db.run((db) => db.delete(note).where(eq(note.id, input.noteId)));

  return Result.ok({ id: input.noteId });
});
