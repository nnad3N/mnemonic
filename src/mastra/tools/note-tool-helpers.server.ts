import { Result, TaggedError } from "better-result";
import { eq } from "drizzle-orm";

import { note, noteVersion, threadRun } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { hashText } from "@/lib/hash";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit.server";
import { resolveThread } from "@/lib/middleware/resolve-thread.server";
import type { SafeId } from "@/lib/safe-id";
import {
  getThreadTopicId,
  toNoteScope,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

export class NoteToolError extends TaggedError("NoteToolError")<{
  message: string;
}> {}

type ReadNoteInScopeCtx = Kits<[DbKit, MemoryKit]>;

type ReadNoteInScopeInput = {
  noteId: SafeId<"note">;
  threadId: string;
  userId: SafeId<"user">;
};

export const readNoteInScope = Kit.gen(async function* (
  ctx: ReadNoteInScopeCtx,
  input: ReadNoteInScopeInput,
) {
  const [noteRow, { topicId }] = yield* await Kit.promiseAll([
    ctx.db.run((db) =>
      db.query.note.findFirst({
        where: { id: input.noteId, userId: input.userId },
        columns: { id: true, threadId: true, title: true, topicId: true },
      }),
    ),
    resolveThread(ctx, { threadId: input.threadId, userId: input.userId }),
  ]);

  if (!noteRow) {
    return Result.err(new NoteToolError({ message: "Note not found" }));
  }

  const scope = toNoteScope(noteRow);
  const found = { id: noteRow.id, scope, title: noteRow.title };

  if (scope.type === "topic") {
    if (scope.id === topicId) {
      return Result.ok(found);
    }

    return Result.err(new NoteToolError({ message: "Note not found" }));
  }

  if (scope.id === input.threadId) {
    return Result.ok(found);
  }

  if (topicId) {
    const noteThreadTopicId = yield* await getThreadTopicId(ctx, {
      threadId: scope.id,
      userId: input.userId,
    });

    if (noteThreadTopicId === topicId) {
      return Result.ok(found);
    }
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
