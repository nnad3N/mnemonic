import { Result, TaggedError } from "better-result";
import { eq, or, sql } from "drizzle-orm";

import { note, noteVersion, threadRun } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { hashText } from "@/lib/hash";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { createSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";

export class NoteToolError extends TaggedError("NoteToolError")<{
  message: string;
}> {}

type NoteScopeFilterInput = {
  threadId: string;
  topicId: SafeId<"topic"> | undefined;
};

export const noteScopeFilter = (table: typeof note, input: NoteScopeFilterInput) =>
  sql`(${or(
    eq(table.threadId, input.threadId),
    input.topicId ? eq(table.topicId, input.topicId) : undefined,
  )})`;

type ReadVisibleNoteInput = {
  noteId: SafeId<"note">;
  threadId: string;
  topicId: SafeId<"topic"> | undefined;
  userId: SafeId<"user">;
};

export const readVisibleNote = Kit.gen(async function* (
  ctx: Kits<[DbKit]>,
  input: ReadVisibleNoteInput,
) {
  const noteRow = yield* await ctx.db.run((db) =>
    db.query.note.findFirst({
      where: {
        id: input.noteId,
        userId: input.userId,
        RAW: (table) => noteScopeFilter(table, input),
      },
      columns: { id: true, title: true },
      with: {
        versions: {
          columns: { content: true, id: true },
          limit: 1,
          orderBy: { seq: "desc" },
        },
      },
    }),
  );

  const latestVersion = noteRow?.versions.at(0);

  if (!noteRow || !latestVersion) {
    return Result.err(new NoteToolError({ message: "Note not found" }));
  }

  return Result.ok({ id: noteRow.id, latestVersion, title: noteRow.title });
});

type WriteAgentVersionInput = {
  content: string;
  noteId: SafeId<"note">;
  threadId: string;
};

export const writeAgentNoteVersion = Kit.gen(async function* (
  ctx: Kits<[DbKit]>,
  input: WriteAgentVersionInput,
) {
  const contentHash = await hashText(input.content);

  const versionId = yield* await ctx.db.transaction(async (tx) => {
    const [run, latestVersion] = await Promise.all([
      tx.query.threadRun.findFirst({
        where: { threadId: input.threadId },
        columns: { versionedNoteIds: true },
      }),
      tx.query.noteVersion.findFirst({
        where: { noteId: input.noteId },
        columns: { author: true, id: true, seq: true },
        orderBy: { seq: "desc" },
      }),
    ]);

    await tx.update(note).set({ updatedAt: new Date() }).where(eq(note.id, input.noteId));

    if (run && latestVersion?.author === "agent" && run.versionedNoteIds.includes(input.noteId)) {
      await tx
        .update(noteVersion)
        .set({ content: input.content, contentHash, reviewedAt: null })
        .where(eq(noteVersion.id, latestVersion.id));

      return latestVersion.id;
    }

    const nextVersionId = createSafeId<"noteVersion">();

    await tx.insert(noteVersion).values({
      author: "agent",
      content: input.content,
      contentHash,
      id: nextVersionId,
      noteId: input.noteId,
      seq: (latestVersion?.seq ?? 0) + 1,
    });

    if (run) {
      await tx
        .update(threadRun)
        .set({ versionedNoteIds: [...run.versionedNoteIds, input.noteId] })
        .where(eq(threadRun.threadId, input.threadId));
    }

    return nextVersionId;
  });

  return Result.ok({ id: input.noteId, versionId });
});
