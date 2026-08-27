import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import type { DbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import type { MemoryKit } from "@/lib/memory-kit.server";
import { mentionKeyFormat, parseMentionKey } from "@/lib/mention-key";
import { toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import {
  NoteToolError,
  readNoteInScope,
  writeAgentNoteVersion,
} from "@/mastra/tools/note-tool-helpers.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";
import { readLatestVersion } from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

type UpdateNoteCtx = Kits<[DbKit, MemoryKit]>;

type UpdateNoteInput = {
  noteId: SafeId<"note">;
  threadId: string;
  userId: SafeId<"user">;
  newText: string;
  oldText: string;
};

export const updateAgentNoteFn = Kit.gen(async function* (
  ctx: UpdateNoteCtx,
  input: UpdateNoteInput,
) {
  const [latest] = yield* await Kit.promiseAll([
    readLatestVersion(ctx, input),
    readNoteInScope(ctx, input),
  ]);

  if (!latest) {
    return Result.err(new NoteToolError({ message: "Note not found" }));
  }

  const occurrences = latest.content.split(input.oldText).length - 1;

  if (occurrences === 0) {
    return Result.err(new NoteToolError({ message: "oldText was not found in the note" }));
  }

  if (occurrences > 1) {
    return Result.err(
      new NoteToolError({
        message: `oldText appears ${occurrences} times in the note; extend it until it matches once`,
      }),
    );
  }

  yield* await writeAgentNoteVersion(ctx, {
    // The callback form keeps $-sequences in the replacement literal.
    content: latest.content.replace(input.oldText, () => input.newText),
    noteId: input.noteId,
    threadId: input.threadId,
  });

  return Result.ok({ id: input.noteId });
});

export const updateNoteInputSchema = v.object({
  noteKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(`Mention key of the note, in the shape ${mentionKeyFormat(["note"])}.`),
  ),
  oldText: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description("Exact text to replace. Must appear exactly once in the note."),
  ),
  newText: v.pipe(v.string(), v.description("Markdown.")),
});

export const updateNoteOutputSchema = v.variant("type", [
  v.object({
    type: v.literal("updated"),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type UpdateNoteOutput = v.InferOutput<typeof updateNoteOutputSchema>;

const noteToolCtx = Kit.createContext(dbKit, memoryKit);

export const updateNoteTool = createTool({
  id: "update-note",
  description: "Replaces one exact occurrence of text in a note.",
  inputSchema: toToolInputSchema(updateNoteInputSchema),
  outputSchema: toStandardJsonSchema(updateNoteOutputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async ({ newText, noteKey, oldText }, context): Promise<UpdateNoteOutput> => {
    const mention = parseMentionKey(noteKey);

    if (mention.type !== "note") {
      return { type: "error", message: `Not a note mention key: ${noteKey}` };
    }

    const result = await updateAgentNoteFn(noteToolCtx, {
      newText,
      oldText,
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with the userId filter.
      noteId: toSafeId<"note">(mention.value),
      threadId: context.requestContext.get("threadId"),
      userId: context.requestContext.get("userId"),
    });

    if (Result.isError(result)) {
      return matchError(result.error, {
        NoteToolError: (error) => ({ type: "error" as const, message: error.message }),
        DatabaseError: (cause) => {
          throw new ToolError({ message: "Note could not be updated.", cause });
        },
        MemoryError: (cause) => {
          throw new ToolError({ message: "Note could not be updated.", cause });
        },
        ThreadNotFoundError: (cause) => {
          throw new ToolError({ message: "Note could not be updated.", cause });
        },
      });
    }

    return { type: "updated" };
  },
});
