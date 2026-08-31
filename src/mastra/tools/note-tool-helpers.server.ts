import { Result, TaggedError } from "better-result";
import { eq } from "drizzle-orm";

import { note, noteVersion, threadRun } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { hashText } from "@/lib/hash";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";

export class NoteToolError extends TaggedError("NoteToolError")<{
  message: string;
}> {}

type ReadNoteInScopeInput = {
  noteId: SafeId<"note">;
  threadId: string;
  topicId: SafeId<"topic"> | undefined;
  userId: SafeId<"user">;
};

/** A note the agent may touch: one written in this thread, or one shared into the topic. */
export const readNoteInScope = Kit.gen(async function* (
  ctx: Kits<[DbKit]>,
  input: ReadNoteInScopeInput,
) {
  const noteRow = yield* await ctx.db.run((db) =>
    db.query.note.findFirst({
      where: { id: input.noteId, userId: input.userId },
      columns: { id: true, threadId: true, title: true, topicId: true },
    }),
  );

  if (noteRow?.threadId === input.threadId) {
    return Result.ok({ id: noteRow.id, title: noteRow.title });
  }

  if (input.topicId && noteRow?.topicId === input.topicId) {
    return Result.ok({ id: noteRow.id, title: noteRow.title });
  }

  return Result.err(new NoteToolError({ message: "Note not found" }));
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

  yield* await ctx.db.transaction(async (tx) => {
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

    if (run && latestVersion?.author === "agent" && run.versionedNoteIds.includes(input.noteId)) {
      await tx
        .update(noteVersion)
        .set({ content: input.content, contentHash, reviewedAt: null })
        .where(eq(noteVersion.id, latestVersion.id));
    } else {
      await tx.insert(noteVersion).values({
        author: "agent",
        content: input.content,
        contentHash,
        noteId: input.noteId,
        seq: (latestVersion?.seq ?? 0) + 1,
      });

      if (run) {
        await tx
          .update(threadRun)
          .set({ versionedNoteIds: [...run.versionedNoteIds, input.noteId] })
          .where(eq(threadRun.threadId, input.threadId));
      }
    }

    await tx.update(note).set({ updatedAt: new Date() }).where(eq(note.id, input.noteId));
  });

  return Result.ok({ id: input.noteId });
});
