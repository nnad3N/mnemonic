import { matchError, panic, Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";
import { and, eq, gt, isNotNull, lt, sql } from "drizzle-orm";

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

export const readLatestVersion = Kit.gen(async function* (
  ctx: NoteCtx,
  input: { noteId: SafeId<"note"> },
) {
  const latestVersion = yield* await ctx.db.run((db) =>
    db.query.noteVersion.findFirst({
      where: { noteId: input.noteId },
      columns: {
        author: true,
        content: true,
        contentHash: true,
        id: true,
        reviewedAt: true,
        seq: true,
        updatedAt: true,
      },
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

type GetNoteInput = {
  noteId: SafeId<"note">;
  userId: SafeId<"user">;
};

export const getNoteFn = Kit.gen(async function* (
  ctx: Kits<[DbKit, MemoryKit]>,
  input: GetNoteInput,
) {
  const note = yield* await readNote(ctx, input);
  const [latest, latestSettledVersion, threadTopicId] = yield* await Kit.promiseAll([
    readLatestVersion(ctx, input),
    ctx.db.run((db) =>
      db.query.noteVersion.findFirst({
        where: {
          noteId: input.noteId,
          OR: [{ author: "user" }, { reviewedAt: { isNotNull: true } }],
        },
        columns: { content: true, id: true },
        orderBy: { seq: "desc" },
      }),
    ),
    getThreadTopicId(ctx, {
      threadId: note.scope.type === "thread" ? note.scope.id : null,
      userId: input.userId,
    }),
  ]);

  if (!latest) {
    return Result.err(toServerFnError.notFound("Note not found"));
  }

  const reviewPending = latest.author === "agent" && !latest.reviewedAt;
  const pendingReviewBaseVersionId =
    reviewPending && latestSettledVersion?.content ? latestSettledVersion.id : null;

  return Result.ok({
    content: latest.content,
    contentHash: latest.contentHash,
    id: note.id,
    lastAuthor: latest.author,
    pendingReviewBaseVersionId,
    scope: note.scope,
    threadTopicId,
    title: note.title,
    versionId: latest.id,
    versionUpdatedAt: latest.updatedAt,
  });
});

const NOTE_VERSION_LIMIT = 100;

type SaveNoteBodyInput = {
  noteId: SafeId<"note">;
  content: string;
} & ({ intent: "append" } | { intent: "overwrite"; baseVersionId: string });

export const saveNoteBodyFn = Kit.gen(async function* (ctx: NoteCtx, input: SaveNoteBodyInput) {
  const contentHash = await hashText(input.content);

  const saved = yield* await ctx.db.transaction(async (tx) => {
    const [latestVersion, latestUserVersion] = await Promise.all([
      tx.query.noteVersion.findFirst({
        where: { noteId: input.noteId },
        columns: { author: true, id: true, seq: true },
        orderBy: { seq: "desc" },
      }),
      tx.query.noteVersion.findFirst({
        where: { author: "user", noteId: input.noteId },
        columns: { id: true },
        orderBy: { seq: "desc" },
      }),
    ]);

    if (input.intent === "overwrite") {
      if (input.baseVersionId !== latestUserVersion?.id) {
        return new StaleNoteVersionError({ message: "The base is not the latest user version" });
      }

      await tx
        .update(noteVersion)
        .set({ content: input.content, contentHash })
        .where(eq(noteVersion.id, latestUserVersion.id));

      return {
        isLatest: latestUserVersion.id === latestVersion?.id,
        versionId: latestUserVersion.id,
      };
    }

    if (latestVersion?.author !== "agent") {
      return new StaleNoteVersionError({
        message: "A new user version can only follow an agent version",
      });
    }

    const versionId = createSafeId<"noteVersion">();

    await Promise.all([
      tx.insert(noteVersion).values({
        author: "user",
        content: input.content,
        contentHash,
        id: versionId,
        noteId: input.noteId,
        seq: latestVersion.seq + 1,
      }),
      tx.update(note).set({ updatedAt: new Date() }).where(eq(note.id, input.noteId)),
    ]);

    const limitVersion = await tx.query.noteVersion.findFirst({
      where: { noteId: input.noteId },
      columns: { seq: true },
      orderBy: { seq: "desc" },
      offset: NOTE_VERSION_LIMIT - 1,
    });

    // The cut always lands on a user version, so a run of more than NOTE_VERSION_LIMIT agent
    // versions with no user version between them stays above the limit. Known and left uncovered.
    if (limitVersion) {
      const cutoff = await tx.query.noteVersion.findFirst({
        where: { author: "user", noteId: input.noteId, seq: { lte: limitVersion.seq } },
        columns: { seq: true },
        orderBy: { seq: "desc" },
      });

      if (cutoff) {
        await tx
          .delete(noteVersion)
          .where(and(eq(noteVersion.noteId, input.noteId), lt(noteVersion.seq, cutoff.seq)));
      }
    }

    return { isLatest: true, versionId };
  });

  if (StaleNoteVersionError.is(saved)) {
    return Result.err(saved);
  }

  return Result.ok({ contentHash, isLatest: saved.isLatest, versionId: saved.versionId });
});

export class StaleNoteVersionError extends TaggedError("StaleNoteVersionError")<{
  message: string;
}> {}

type SaveAgentVersionInput = {
  noteId: SafeId<"note">;
  commit: boolean;
  content: string;
  versionId: string;
  versionUpdatedAt: number;
};

export const saveAgentVersionFn = Kit.gen(async function* (
  ctx: NoteCtx,
  input: SaveAgentVersionInput,
) {
  const contentHash = await hashText(input.content);

  const saved = yield* await ctx.db.transaction(async (tx) => {
    const latestVersion = await tx.query.noteVersion.findFirst({
      where: { noteId: input.noteId },
      columns: { author: true, id: true, updatedAt: true },
      orderBy: { seq: "desc" },
    });

    if (latestVersion?.id !== input.versionId || latestVersion.author !== "agent") {
      return { status: "stale" as const };
    }

    // A moved stamp means the agent wrote after the edit's snapshot; the client merges first.
    if (latestVersion.updatedAt.getTime() !== input.versionUpdatedAt) {
      return { status: "stale" as const };
    }

    const updatedAt = new Date();

    await Promise.all([
      tx
        .update(noteVersion)
        .set({
          content: input.content,
          contentHash,
          reviewedAt: input.commit ? updatedAt : null,
          updatedAt,
        })
        .where(eq(noteVersion.id, latestVersion.id)),
      tx.update(note).set({ updatedAt }).where(eq(note.id, input.noteId)),
    ]);

    return { status: "saved" as const, updatedAt };
  });

  if (saved.status === "stale") {
    return Result.err(
      new StaleNoteVersionError({ message: "The note version moved past this edit" }),
    );
  }

  return Result.ok({ contentHash, updatedAt: saved.updatedAt });
});

type DeclineAgentVersionsInput = {
  noteId: SafeId<"note">;
};

export const declineAgentVersionsFn = Kit.gen(async function* (
  ctx: NoteCtx,
  input: DeclineAgentVersionsInput,
) {
  const restored = yield* await ctx.db.transaction(async (tx) => {
    const latestSettledVersion = await tx.query.noteVersion.findFirst({
      where: {
        noteId: input.noteId,
        OR: [{ author: "user" }, { reviewedAt: { isNotNull: true } }],
      },
      columns: {
        author: true,
        content: true,
        contentHash: true,
        id: true,
        seq: true,
        updatedAt: true,
      },
      orderBy: { seq: "desc" },
    });

    if (!latestSettledVersion) {
      return new StaleNoteVersionError({
        message: "The note has no reviewed version to fall back to",
      });
    }

    const updatedAt = new Date();

    await Promise.all([
      tx
        .delete(noteVersion)
        .where(
          and(eq(noteVersion.noteId, input.noteId), gt(noteVersion.seq, latestSettledVersion.seq)),
        ),
      tx.update(note).set({ updatedAt }).where(eq(note.id, input.noteId)),
    ]);

    return {
      author: latestSettledVersion.author,
      content: latestSettledVersion.content,
      contentHash: latestSettledVersion.contentHash,
      updatedAt: latestSettledVersion.updatedAt,
      versionId: latestSettledVersion.id,
    };
  });

  if (StaleNoteVersionError.is(restored)) {
    return Result.err(restored);
  }

  return Result.ok(restored);
});

type ResetNoteToVersionInput = {
  noteId: SafeId<"note">;
  versionId: string;
};

export const resetNoteToVersionFn = Kit.gen(async function* (
  ctx: NoteCtx,
  input: ResetNoteToVersionInput,
) {
  const target = yield* await ctx.db.transaction(async (tx) => {
    const target = await tx.query.noteVersion.findFirst({
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with the noteId filter.
      where: { id: toSafeId<"noteVersion">(input.versionId), noteId: input.noteId },
      columns: { id: true, seq: true },
    });

    if (!target) {
      return null;
    }

    await Promise.all([
      tx
        .delete(noteVersion)
        .where(and(eq(noteVersion.noteId, input.noteId), gt(noteVersion.seq, target.seq))),
      tx.update(note).set({ updatedAt: new Date() }).where(eq(note.id, input.noteId)),
    ]);

    return target;
  });

  if (!target) {
    return Result.err(toServerFnError.notFound("Note version not found"));
  }

  return Result.ok({ versionId: target.id });
});

type GetNoteVersionInput = {
  noteId: SafeId<"note">;
  versionId: string;
};

export const getNoteVersionFn = Kit.gen(async function* (ctx: NoteCtx, input: GetNoteVersionInput) {
  const version = yield* await ctx.db.run((db) =>
    db.query.noteVersion.findFirst({
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with the noteId filter.
      where: { id: toSafeId<"noteVersion">(input.versionId), noteId: input.noteId },
      columns: { content: true, id: true },
    }),
  );

  if (!version) {
    return Result.err(toServerFnError.notFound("Note version not found"));
  }

  return Result.ok(version);
});

type ListNoteVersionsInput = {
  noteId: SafeId<"note">;
};

export type NoteTimelineEntry = {
  author: NoteVersionAuthor;
  createdAt: Date;
  id: SafeId<"noteVersion">;
  seq: number;
  updatedAt: Date;
};

export const listNoteVersionsFn = Kit.gen(async function* (
  ctx: NoteCtx,
  input: ListNoteVersionsInput,
) {
  const versions = yield* await ctx.db.run((db) =>
    db.query.noteVersion.findMany({
      where: { noteId: input.noteId },
      columns: {
        author: true,
        createdAt: true,
        id: true,
        seq: true,
        updatedAt: true,
      },
      orderBy: { seq: "desc" },
    }),
  );

  if (versions.length === 0) {
    return panic("Note has no versions");
  }

  return Result.ok({ entries: versions });
});

type SaveNoteTitleInput = {
  noteId: SafeId<"note">;
  title: string;
};

export const saveNoteTitleFn = Kit.gen(async function* (ctx: NoteCtx, input: SaveNoteTitleInput) {
  yield* await ctx.db.run((db) =>
    db.update(note).set({ title: input.title }).where(eq(note.id, input.noteId)),
  );

  return Result.ok({ id: input.noteId });
});

type AddNoteToTopicInput = {
  noteId: SafeId<"note">;
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

export const deleteNoteFn = Kit.gen(async function* (
  ctx: NoteCtx,
  input: { noteId: SafeId<"note"> },
) {
  yield* await ctx.db.run((db) => db.delete(note).where(eq(note.id, input.noteId)));

  return Result.ok({ id: input.noteId });
});
