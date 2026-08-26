import { Result } from "better-result";
import { and, eq, isNotNull } from "drizzle-orm";

import { note, noteVersion } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import { hashText } from "@/lib/hash";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit.server";
import { resolveThread } from "@/lib/middleware/resolve-thread.server";
import { createSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";

type NoteCtx = Kits<[DbKit]>;
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
