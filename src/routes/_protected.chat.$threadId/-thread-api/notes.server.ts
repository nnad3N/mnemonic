import { matchError, panic, Result } from "better-result";
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

export const toNoteScope = (row: {
  threadId: string | null;
  topicId: SafeId<"topic"> | null;
}): NoteScope => {
  if (row.topicId) {
    return { id: row.topicId, type: "topic" };
  }

  if (row.threadId) {
    return { id: row.threadId, type: "thread" };
  }

  return panic("Note has neither a thread nor a topic");
};

type ReadNoteInput = {
  noteId: SafeId<"note">;
  userId: SafeId<"user">;
};

const readNote = Kit.gen(async function* (ctx: NoteCtx, input: ReadNoteInput) {
  const note = yield* await ctx.db.run((db) =>
    db.query.note.findFirst({
      where: { id: input.noteId, userId: input.userId },
      columns: { id: true, threadId: true, title: true, topicId: true },
    }),
  );

  if (!note) {
    return Result.err(toServerFnError.notFound("Note not found"));
  }

  return Result.ok({ id: note.id, scope: toNoteScope(note), title: note.title });
});

export const readLatestVersion = Kit.gen(async function* (ctx: NoteCtx, input: NoteIdInput) {
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
  author: NoteVersionAuthor;
  content: string;
  threadId: string;
  title: string;
  userId: SafeId<"user">;
};

export const createNoteFn = Kit.gen(async function* (ctx: NoteCtx, input: CreateNoteInput) {
  const id = createSafeId<"note">();
  const contentHash = await hashText(input.content);

  yield* await ctx.db.transaction(async (tx) => {
    await tx.insert(note).values({
      id,
      threadId: input.threadId,
      title: input.title,
      userId: input.userId,
    });

    await tx.insert(noteVersion).values({
      author: input.author,
      content: input.content,
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
  search: string | undefined;
  userId: SafeId<"user">;
};

export type NoteScope = { id: string; type: "thread" } | { id: string; type: "topic" };

export type NoteListItem = {
  id: SafeId<"note">;
  lastAuthor: NoteVersionAuthor;
  title: string;
  updatedAt: Date;
};

export const getThreadTopicId = async (
  ctx: Kits<[DbKit, MemoryKit]>,
  input: { threadId: string | null; userId: SafeId<"user"> },
): Promise<ResultType<SafeId<"topic"> | null, DatabaseError | MemoryError>> => {
  if (!input.threadId) {
    return Result.ok(null);
  }

  const thread = await resolveThread(ctx, { threadId: input.threadId, userId: input.userId });

  if (Result.isError(thread)) {
    return matchError(thread.error, {
      DatabaseError: (failure) => Result.err(failure),
      MemoryError: (failure) => Result.err(failure),
      ThreadNotFoundError: () => Result.ok(null),
    });
  }

  return Result.ok(thread.value.topicId ?? null);
};

export const listNotesFn = Kit.gen(async function* (ctx: ListNotesCtx, input: ListNotesInput) {
  const scopedToUser = (table: typeof note) => {
    const conditions = [
      eq(table.userId, input.userId),
      input.scope.type === "thread"
        ? eq(table.threadId, input.scope.id)
        : // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with the userId filter.
          eq(table.topicId, toSafeId<"topic">(input.scope.id)),
    ];

    if (input.search) {
      conditions.push(ilike(table.title, input.search));
    }

    return sql.join(conditions, sql` and `);
  };

  const [{ notes, totalCount }, threadTopicId] = yield* await Kit.promiseAll([
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
    getThreadTopicId(ctx, {
      threadId: input.scope.type === "thread" ? input.scope.id : null,
      userId: input.userId,
    }),
  ]);

  return Result.ok({
    items: notes.map((listed) => ({
      id: listed.id,
      lastAuthor: listed.versions.at(0)?.author ?? "user",
      title: listed.title,
      updatedAt: listed.updatedAt,
    })),
    threadTopicId,
    totalCount,
  });
});

type GetNoteInput = NoteIdInput & {
  userId: SafeId<"user">;
};

export const getNoteFn = Kit.gen(async function* (
  ctx: Kits<[DbKit, MemoryKit]>,
  input: GetNoteInput,
) {
  const note = yield* await readNote(ctx, input);
  const [latest, threadTopicId] = yield* await Kit.promiseAll([
    readLatestVersion(ctx, input),
    getThreadTopicId(ctx, {
      threadId: note.scope.type === "thread" ? note.scope.id : null,
      userId: input.userId,
    }),
  ]);

  if (!latest) {
    return Result.err(toServerFnError.notFound("Note not found"));
  }

  return Result.ok({
    content: latest.content,
    contentHash: latest.contentHash,
    id: note.id,
    scope: note.scope,
    threadTopicId,
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

    await Promise.all([
      tx.insert(noteVersion).values({
        author: "user",
        content: input.content,
        contentHash,
        noteId: input.noteId,
        seq: (latestVersion?.seq ?? 0) + 1,
      }),
      tx.update(note).set({ updatedAt: new Date() }).where(eq(note.id, input.noteId)),
    ]);
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

  if (noteRow.scope.type === "topic") {
    return Result.err(toServerFnError.badRequest("This note already lives in a topic"));
  }

  const thread = yield* await resolveThread(ctx, {
    threadId: noteRow.scope.id,
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
