import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import { mentionKeyFormat, parseMentionKey } from "@/lib/mention-key";
import { toSafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { readVisibleNote } from "@/mastra/tools/note-tool-helpers.server";

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

const noteToolCtx = Kit.createContext(dbKit);

export const readNoteTool = createTool({
  id: "read-note",
  description: "Reads a note's title and markdown content.",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async ({ noteKey }, { requestContext }): Promise<ReadNoteOutput> => {
    const mention = parseMentionKey(noteKey);

    if (mention.type !== "note") {
      return { type: "error", message: `Not a note mention key: ${noteKey}` };
    }

    const result = await readVisibleNote(noteToolCtx, {
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with the userId filter.
      noteId: toSafeId<"note">(mention.value),
      threadId: requestContext.get("threadId"),
      topicId: requestContext.get("filter")?.topicId,
      userId: requestContext.get("userId"),
    });

    if (Result.isError(result)) {
      return matchError(result.error, {
        NoteToolError: (error) => ({ type: "error" as const, message: error.message }),
        DatabaseError: (cause) => {
          throw new ToolError({ message: "Note could not be read.", cause });
        },
      });
    }

    return { type: "note", content: result.value.latestVersion.content, title: result.value.title };
  },
});
