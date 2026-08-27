import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { dbKit, type DbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit, type MemoryKit } from "@/lib/memory-kit.server";
import { mentionKeyFormat, parseMentionKey } from "@/lib/mention-key";
import { toSafeId, type SafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { NoteToolError, readNoteInScope } from "@/mastra/tools/note-tool-helpers.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";
import { readLatestVersion } from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

type ReadNoteCtx = Kits<[DbKit, MemoryKit]>;

type ReadNoteInput = {
  noteId: SafeId<"note">;
  threadId: string;
  userId: SafeId<"user">;
};

export const readAgentNoteFn = Kit.gen(async function* (ctx: ReadNoteCtx, input: ReadNoteInput) {
  const [latest, noteRow] = yield* await Kit.promiseAll([
    readLatestVersion(ctx, input),
    readNoteInScope(ctx, input),
  ]);

  if (!latest) {
    return Result.err(new NoteToolError({ message: "Note not found" }));
  }

  return Result.ok({ content: latest.content, title: noteRow.title });
});

const inputSchema = v.object({
  noteKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(`Mention key of the note, in the shape ${mentionKeyFormat(["note"])}.`),
  ),
});

const outputSchema = v.variant("type", [
  v.object({
    type: v.literal("note"),
    title: v.string(),
    content: v.string(),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type ReadNoteOutput = v.InferOutput<typeof outputSchema>;

const noteToolCtx = Kit.createContext(dbKit, memoryKit);

export const readNoteTool = createTool({
  id: "read-note",
  description: "Reads a note's title and markdown content.",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async ({ noteKey }, context): Promise<ReadNoteOutput> => {
    const mention = parseMentionKey(noteKey);

    if (mention.type !== "note") {
      return { type: "error", message: `Not a note mention key: ${noteKey}` };
    }

    const result = await readAgentNoteFn(noteToolCtx, {
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with the userId filter.
      noteId: toSafeId<"note">(mention.value),
      threadId: context.requestContext.get("threadId"),
      userId: context.requestContext.get("userId"),
    });

    if (Result.isError(result)) {
      return matchError(result.error, {
        NoteToolError: (error) => ({ type: "error" as const, message: error.message }),
        DatabaseError: (cause) => {
          throw new ToolError({ message: "Note could not be read.", cause });
        },
        MemoryError: (cause) => {
          throw new ToolError({ message: "Note could not be read.", cause });
        },
        ThreadNotFoundError: (cause) => {
          throw new ToolError({ message: "Note could not be read.", cause });
        },
      });
    }

    return { type: "note", content: result.value.content, title: result.value.title };
  },
});
