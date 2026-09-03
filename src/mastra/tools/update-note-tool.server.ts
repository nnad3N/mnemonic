import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import type { DbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { mentionKeyFormat, parseMentionKey } from "@/lib/mention-key";
import { rawId, toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import {
  NoteToolError,
  readNoteInScope,
  writeAgentNoteVersion,
} from "@/mastra/tools/note-tool-helpers.server";
import { readLatestVersion } from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

type UpdateNoteCtx = Kits<[DbKit]>;

type UpdateNoteInput = {
  noteId: SafeId<"note">;
  threadId: string;
  topicId: SafeId<"topic"> | undefined;
  userId: SafeId<"user">;
} & (
  | { mode: "replace"; newText: string; oldText: string }
  | { mode: "overwrite"; newText: string }
);

/**
 * The ways a model's echo of prose drifts from the stored bytes: trailing whitespace, smart
 * quotes, Unicode dashes and spaces. Never touches newlines, so line numbers stay aligned with
 * the original content.
 */
const normalizeForFuzzyMatch = (text: string): string =>
  text
    .normalize("NFKC")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replaceAll(/[\u2018\u2019\u201A\u201B]/gu, "'")
    .replaceAll(/[\u201C\u201D\u201E\u201F]/gu, '"')
    .replaceAll(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/gu, "-")
    .replaceAll(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/gu, " ");

type ReplaceNoteTextResult =
  | { type: "replaced"; content: string }
  | { type: "not-found" }
  | { type: "ambiguous"; occurrences: number };

export const replaceNoteText = (
  content: string,
  oldText: string,
  newText: string,
): ReplaceNoteTextResult => {
  const exactOccurrences = content.split(oldText).length - 1;

  if (exactOccurrences === 1) {
    // The callback form keeps $-sequences in the replacement literal.
    return { type: "replaced", content: content.replace(oldText, () => newText) };
  }

  if (exactOccurrences > 1) {
    return { type: "ambiguous", occurrences: exactOccurrences };
  }

  const fuzzyContent = normalizeForFuzzyMatch(content);
  const fuzzyOldText = normalizeForFuzzyMatch(oldText);
  const fuzzyOccurrences = fuzzyContent.split(fuzzyOldText).length - 1;

  if (fuzzyOccurrences === 0) {
    return { type: "not-found" };
  }

  if (fuzzyOccurrences > 1) {
    return { type: "ambiguous", occurrences: fuzzyOccurrences };
  }

  // Replace in normalized space, then splice only the matched lines back into the original,
  // so every line outside the match keeps its exact bytes.
  const matchStart = fuzzyContent.indexOf(fuzzyOldText);
  const matchEnd = matchStart + fuzzyOldText.length;
  const firstLine = fuzzyContent.slice(0, matchStart).split("\n").length - 1;
  const lastLine = fuzzyContent.slice(0, matchEnd).split("\n").length - 1;
  const fuzzyLines = fuzzyContent.split("\n");
  const originalLines = content.split("\n");
  const spanStart = fuzzyLines
    .slice(0, firstLine)
    .reduce((length, line) => length + line.length + 1, 0);
  const span = fuzzyLines.slice(firstLine, lastLine + 1).join("\n");
  const newSpan =
    span.slice(0, matchStart - spanStart) + newText + span.slice(matchEnd - spanStart);

  return {
    type: "replaced",
    content: [
      ...originalLines.slice(0, firstLine),
      newSpan,
      ...originalLines.slice(lastLine + 1),
    ].join("\n"),
  };
};

export const updateAgentNoteFn = Kit.gen(async function* (
  ctx: UpdateNoteCtx,
  input: UpdateNoteInput,
) {
  if (input.mode === "overwrite") {
    yield* await readNoteInScope(ctx, input);
    const written = yield* await writeAgentNoteVersion(ctx, {
      content: input.newText,
      noteId: input.noteId,
      threadId: input.threadId,
    });

    return Result.ok(written);
  }

  const [latest] = yield* await Kit.promiseAll([
    readLatestVersion(ctx, input),
    readNoteInScope(ctx, input),
  ]);

  if (!latest) {
    return Result.err(new NoteToolError({ message: "Note not found" }));
  }

  const replaced = replaceNoteText(latest.content, input.oldText, input.newText);

  if (replaced.type === "not-found") {
    return Result.err(new NoteToolError({ message: "oldText was not found in the note" }));
  }

  if (replaced.type === "ambiguous") {
    return Result.err(
      new NoteToolError({
        message: `oldText appears ${replaced.occurrences} times in the note; extend it until it matches once`,
      }),
    );
  }

  const written = yield* await writeAgentNoteVersion(ctx, {
    content: replaced.content,
    noteId: input.noteId,
    threadId: input.threadId,
  });

  return Result.ok(written);
});

const noteKeySchema = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.description(`Mention key of the note, in the shape ${mentionKeyFormat(["note"])}.`),
);

const newTextSchema = v.pipe(v.string(), v.description("Markdown."));

const inputSchema = v.object({
  noteKey: noteKeySchema,
  oldText: v.optional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description(
        "Exact text to replace, appearing exactly once in the note. Omit to replace the whole content.",
      ),
    ),
  ),
  newText: newTextSchema,
});

export const updateNoteOutputSchema = v.variant("type", [
  v.object({
    type: v.literal("updated"),
    noteId: v.pipe(v.string(), v.nanoid()),
    versionId: v.pipe(v.string(), v.nanoid()),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type UpdateNoteOutput = v.InferOutput<typeof updateNoteOutputSchema>;

const noteToolCtx = Kit.createContext(dbKit);

export const updateNoteTool = createTool({
  id: "update-note",
  description:
    "Replaces one exact occurrence of text in a note, or overwrites the note's whole content.",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(updateNoteOutputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async ({ noteKey, oldText, newText }, { requestContext }): Promise<UpdateNoteOutput> => {
    const mention = parseMentionKey(noteKey);

    if (mention.type !== "note") {
      return { type: "error", message: `Not a note mention key: ${noteKey}` };
    }

    const edit = oldText
      ? ({ mode: "replace", oldText, newText } as const)
      : ({ mode: "overwrite", newText } as const);

    const result = await updateAgentNoteFn(noteToolCtx, {
      ...edit,
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
          throw new ToolError({ message: "Note could not be updated.", cause });
        },
      });
    }

    return {
      type: "updated",
      noteId: rawId(result.value.id),
      versionId: rawId(result.value.versionId),
    };
  },
});
