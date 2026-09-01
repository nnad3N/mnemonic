import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import { and, desc, eq, gt, notExists, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PgColumn } from "drizzle-orm/pg-core";
import * as v from "valibot";

import { note, noteVersion } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import type { DbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { getMentionKey } from "@/lib/mention-key";
import { rawId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";

const DEFAULT_LIMIT = 10;

/** Markers would read as syntax in a markdown snippet, so the fragments come back unmarked. */
const HEADLINE_OPTIONS = 'MaxFragments=3, MinWords=8, MaxWords=25, StartSel="", StopSel=""';

const languageSchema = v.picklist(["english", "other"]);

export type SearchLanguage = v.InferOutput<typeof languageSchema>;

/**
 * English is the only stemmer worth having here, so every other language searches the unstemmed
 * vector: exact word forms only, but nothing lost to English stemming or to a word that happens
 * to sit on the English stop list.
 */
const SEARCH_BY_LANGUAGE = {
  english: { config: sql`'english'`, vector: noteVersion.searchVectorEnglish },
  other: { config: sql`'simple'`, vector: noteVersion.searchVectorSimple },
} satisfies Record<SearchLanguage, { config: SQL; vector: PgColumn }>;

type SearchNotesCtx = Kits<[DbKit]>;

type SearchNotesInput = {
  language: SearchLanguage;
  limit: number;
  query: string;
  threadId: string;
  topicId: SafeId<"topic"> | undefined;
  userId: SafeId<"user">;
};

export const searchAgentNotesFn = Kit.gen(async function* (
  ctx: SearchNotesCtx,
  input: SearchNotesInput,
) {
  const { config, vector: contentVector } = SEARCH_BY_LANGUAGE[input.language];
  const tsQuery = sql`websearch_to_tsquery(${config}, ${input.query})`;
  const titleVector = sql`to_tsvector(${config}, ${note.title})`;
  const olderVersion = alias(noteVersion, "older_version");

  const found = yield* await ctx.db.run((db) => {
    const isLatestVersion = notExists(
      db
        .select({ seq: olderVersion.seq })
        .from(olderVersion)
        .where(
          and(eq(olderVersion.noteId, noteVersion.noteId), gt(olderVersion.seq, noteVersion.seq)),
        ),
    );

    return db
      .select({
        id: note.id,
        snippet: sql<string>`ts_headline(${config}, ${noteVersion.content}, ${tsQuery}, ${HEADLINE_OPTIONS})`,
        title: note.title,
      })
      .from(note)
      .innerJoin(noteVersion, eq(noteVersion.noteId, note.id))
      .where(
        and(
          eq(note.userId, input.userId),
          or(
            eq(note.threadId, input.threadId),
            input.topicId ? eq(note.topicId, input.topicId) : undefined,
          ),
          isLatestVersion,
          or(sql`${contentVector} @@ ${tsQuery}`, sql`${titleVector} @@ ${tsQuery}`),
        ),
      )
      .orderBy(
        desc(
          sql`ts_rank_cd(setweight(${titleVector}, 'A') || setweight(${contentVector}, 'B'), ${tsQuery})`,
        ),
      )
      .limit(input.limit);
  });

  return Result.ok({
    matches: found.map((row) => ({
      noteKey: getMentionKey({ type: "note", value: rawId(row.id) }),
      snippet: row.snippet,
      title: row.title,
    })),
  });
});

const inputSchema = v.object({
  language: v.pipe(
    languageSchema,
    v.description(
      'Language the notes to find are written in, which is not always the language the user writes in. Anything but English is `"other"`.',
    ),
  ),
  query: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description("Postgres full text search query, in `websearch_to_tsquery` syntax."),
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

const outputSchema = v.object({
  matches: v.array(
    v.object({
      noteKey: v.string(),
      title: v.string(),
      snippet: v.string(),
    }),
  ),
});

const noteToolCtx = Kit.createContext(dbKit);

export const searchNotesTool = createTool({
  id: "search-notes",
  description:
    "Finds notes whose title or text matches the query, with a snippet around the hits. Covers this thread's notes, plus the topic's notes when the thread is in a topic. Matches words, not meaning.",
  inputExamples: [{ input: { language: "english", query: '"cash flow" OR runway -draft' } }],
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async ({ language, limit = DEFAULT_LIMIT, query }, { requestContext }) => {
    const result = await searchAgentNotesFn(noteToolCtx, {
      language,
      limit,
      query,
      threadId: requestContext.get("threadId"),
      topicId: requestContext.get("filter")?.topicId,
      userId: requestContext.get("userId"),
    });

    if (Result.isError(result)) {
      throw new ToolError({ message: "Notes could not be searched.", cause: result.error });
    }

    return result.value;
  },
});
