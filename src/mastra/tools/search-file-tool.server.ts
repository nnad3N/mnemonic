import { extractBytes } from "@kreuzberg/node";
import { createTool } from "@mastra/core/tools";
import { FuzzySearch } from "@stll/fuzzy-search";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import { ImageMimeType } from "@/lib/file-validation";
import { mentionKeyShape } from "@/lib/mention-key";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { loadMentionedFile } from "@/mastra/tools/file-tool-helpers.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";

const DEFAULT_LIMIT = 10;
const MAX_TERM_DISTANCE = 2;
const CHARACTERS_PER_EDIT = 4;
/** Characters of context kept on each side of a hit. */
const SNIPPET_RADIUS = 200;

const inputSchema = v.object({
  fileKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      `Mention key of the file, in the shape ${mentionKeyShape(["file", "attachment"])}.`,
    ),
  ),
  query: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description("Words or a phrase to look for; matching tolerates typos and inflections."),
  ),
  limit: v.optional(
    v.pipe(
      v.number(),
      v.minValue(1),
      v.maxValue(50),
      v.description(`Defaults to ${DEFAULT_LIMIT}.`),
    ),
  ),
});

const matchSchema = v.object({
  page: v.optional(v.number()),
  line: v.pipe(
    v.number(),
    v.description("1-based line within the page, or the file when unpaged."),
  ),
  text: v.string(),
  terms: v.pipe(v.array(v.string()), v.description("Query terms found in this passage.")),
});

const outputSchema = v.variant("type", [
  v.object({
    type: v.literal("matches"),
    displayName: v.pipe(v.string(), v.nonEmpty()),
    matches: v.array(matchSchema),
    totalMatches: v.number(),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type SearchFileOutput = v.InferOutput<typeof outputSchema>;
type FileMatch = v.InferOutput<typeof matchSchema>;

const toTerms = (query: string): string[] => [
  ...new Set(
    query
      .split(/[^\p{L}\p{N}_$]+/u)
      .filter((term) => term.length > 1)
      .map((term) => term.toLowerCase()),
  ),
];

type Passage = {
  start: number;
  end: number;
  terms: Set<string>;
  score: number;
};

/** Merges hits that sit within one snippet radius of each other into a single passage. */
const toPassages = (
  content: string,
  hits: { start: number; end: number; term: string; score: number }[],
): Passage[] => {
  const passages: Passage[] = [];

  for (const hit of hits.toSorted((left, right) => left.start - right.start)) {
    const start = Math.max(0, hit.start - SNIPPET_RADIUS);
    const end = Math.min(content.length, hit.end + SNIPPET_RADIUS);
    const last = passages.at(-1);

    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
      last.terms.add(hit.term);
      last.score += hit.score;
      continue;
    }

    passages.push({ start, end, terms: new Set([hit.term]), score: hit.score });
  }

  return passages;
};

const lineAt = (content: string, offset: number): number => {
  let line = 1;

  for (let index = 0; index < offset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1;
    }
  }

  return line;
};

export const searchFileTool = createTool({
  id: "search-file",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description:
    "Finds passages in one file that mention the query, with page and line locators. Matches words, not meaning.",
  execute: async (
    { fileKey, query, limit = DEFAULT_LIMIT },
    context,
  ): Promise<SearchFileOutput> => {
    const file = await loadMentionedFile({ fileKey, requestContext: context.requestContext });

    if (Result.isError(file)) {
      return { type: "error", message: file.error.message };
    }

    if (ImageMimeType.is(file.value.mimeType)) {
      return { type: "error", message: "The file is an image; it has no text to search." };
    }

    const terms = toTerms(query);

    if (terms.length === 0) {
      return { type: "error", message: "The query has no searchable words." };
    }

    const extraction = await Result.tryPromise(async () =>
      extractBytes(Buffer.from(file.value.bytes), file.value.mimeType, {
        pages: { extractPages: true },
      }),
    );

    if (Result.isError(extraction)) {
      throw new ToolError({ message: "File could not be loaded.", cause: extraction.error });
    }

    const search = new FuzzySearch(
      terms.map((term) => ({
        pattern: term,
        distance: Math.min(MAX_TERM_DISTANCE, Math.floor(term.length / CHARACTERS_PER_EDIT)),
      })),
      { caseInsensitive: true, normalizeDiacritics: true, wholeWords: false },
    );

    const pages = extraction.value.pages ?? [];
    const units =
      pages.length > 0
        ? pages.map((page) => ({ page: page.pageNumber, content: page.content }))
        : [{ page: undefined, content: extraction.value.content }];

    const matches: (FileMatch & { score: number })[] = [];

    for (const unit of units) {
      // `hit.pattern` indexes the patterns array, which was built from `terms` in order.
      const hits = search.findIter(unit.content).map((hit) => ({
        start: hit.start,
        end: hit.end,
        term: terms[hit.pattern],
        score: hit.score,
      }));

      for (const passage of toPassages(unit.content, hits)) {
        matches.push({
          page: unit.page,
          line: lineAt(unit.content, passage.start),
          text: unit.content.slice(passage.start, passage.end).trim(),
          terms: [...passage.terms],
          score: passage.score,
        });
      }
    }

    matches.sort((left, right) =>
      left.terms.length === right.terms.length
        ? right.score - left.score
        : right.terms.length - left.terms.length,
    );

    return {
      type: "matches",
      displayName: file.value.displayName,
      matches: matches.slice(0, limit).map(({ score: _score, ...match }) => match),
      totalMatches: matches.length,
    };
  },
});
