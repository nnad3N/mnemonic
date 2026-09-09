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
  readVisibleNote,
  writeAgentNoteVersion,
} from "@/mastra/tools/note-tool-helpers.server";

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

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

type MatchSpace = {
  text: string;
  /** Original offset for a normalized offset, `undefined` when it falls inside a grapheme. */
  toOriginal: (offset: number) => number | undefined;
};

const foldGrapheme = (grapheme: string): string =>
  grapheme
    .normalize("NFKC")
    .replaceAll(/[\u2018\u2019\u201A\u201B]/gu, "'")
    .replaceAll(/[\u201C\u201D\u201E\u201F]/gu, '"')
    .replaceAll(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/gu, "-");

/**
 * Folds the ways a model's echo of prose drifts from the stored bytes: trailing whitespace, CRLF,
 * compatibility forms, smart quotes, Unicode dashes. Works per grapheme so a base letter still
 * composes with its accent and every normalized offset maps back to the original.
 */
const normalizeForFuzzyMatch = (content: string): MatchSpace => {
  const boundaries = new Map<number, number>();
  let text = "";
  let nextLineStart = 0;
  let trimmedLineEnd = 0;

  for (const { index, segment } of graphemeSegmenter.segment(content)) {
    if (index >= nextLineStart) {
      const newline = content.indexOf("\n", index);
      nextLineStart = newline === -1 ? content.length : newline + 1;
      trimmedLineEnd = index + content.slice(index, nextLineStart).trimEnd().length;
    }

    // First claim wins, so a match ending before dropped trailing whitespace leaves it in place.
    if (!boundaries.has(text.length)) {
      boundaries.set(text.length, index);
    }

    if (segment.endsWith("\n")) {
      text += "\n";
    } else if (index < trimmedLineEnd) {
      text += foldGrapheme(segment);
    }
  }

  if (!boundaries.has(text.length)) {
    boundaries.set(text.length, content.length);
  }

  return { text, toOriginal: (offset) => boundaries.get(offset) };
};

const findOccurrences = (haystack: string, needle: string): number[] => {
  const starts: number[] = [];

  for (
    let start = haystack.indexOf(needle);
    start !== -1;
    start = haystack.indexOf(needle, start + needle.length)
  ) {
    starts.push(start);
  }

  return starts;
};

type ReplaceUniqueTextInput = {
  content: string;
  newText: string;
  oldText: string;
};

export const replaceUniqueText = ({
  content,
  newText,
  oldText,
}: ReplaceUniqueTextInput): Result<string, NoteToolError> => {
  const fuzzyContent = normalizeForFuzzyMatch(content);
  const passes = [
    { needle: oldText, space: { text: content, toOriginal: (offset: number) => offset } },
    { needle: normalizeForFuzzyMatch(oldText).text, space: fuzzyContent },
  ];

  for (const { needle, space } of passes) {
    if (needle === "") {
      continue;
    }

    const starts = findOccurrences(space.text, needle);

    if (starts.length > 1) {
      return Result.err(
        new NoteToolError({
          message: `oldText appears ${starts.length} times in the note; extend it until it matches once`,
        }),
      );
    }

    const start = starts.at(0);

    if (start === undefined) {
      continue;
    }

    const originalStart = space.toOriginal(start);
    const originalEnd = space.toOriginal(start + needle.length);

    if (originalStart === undefined || originalEnd === undefined) {
      continue;
    }

    return Result.ok(content.slice(0, originalStart) + newText + content.slice(originalEnd));
  }

  return Result.err(new NoteToolError({ message: "oldText was not found in the note" }));
};

export const updateAgentNoteFn = Kit.gen(async function* (
  ctx: UpdateNoteCtx,
  input: UpdateNoteInput,
) {
  const visible = yield* await readVisibleNote(ctx, input);

  if (input.mode === "overwrite") {
    const written = yield* await writeAgentNoteVersion(ctx, {
      content: input.newText,
      noteId: input.noteId,
      threadId: input.threadId,
    });

    return Result.ok(written);
  }

  const content = yield* replaceUniqueText({
    content: visible.latestVersion.content,
    newText: input.newText,
    oldText: input.oldText,
  });

  const written = yield* await writeAgentNoteVersion(ctx, {
    content,
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
