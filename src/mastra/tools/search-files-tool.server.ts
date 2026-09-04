import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { panic, Result } from "better-result";
import { and, desc, eq, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import * as v from "valibot";

import {
  HEADLINE_OPTIONS,
  languageSchema,
  SEARCH_CONFIG_BY_LANGUAGE,
} from "@/db/full-text-search.server";
import type { SearchLanguage } from "@/db/full-text-search.server";
import { file, fileContent } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import type { DbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { getMentionKey, mentionKeyFormat, parseMentionKey } from "@/lib/mention-key";
import { rawId, toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";

const DEFAULT_LIMIT = 10;

const SEARCH_VECTOR_BY_LANGUAGE = {
  english: fileContent.searchVectorEnglish,
  other: fileContent.searchVectorSimple,
} satisfies Record<SearchLanguage, PgColumn>;

type SearchFilesCtx = Kits<[DbKit]>;

type SearchFilesInput = {
  fileId: SafeId<"file"> | undefined;
  language: SearchLanguage;
  limit: number;
  query: string;
  topicId: SafeId<"topic">;
};

export const searchAgentFilesFn = Kit.gen(async function* (
  ctx: SearchFilesCtx,
  input: SearchFilesInput,
) {
  const config = SEARCH_CONFIG_BY_LANGUAGE[input.language];
  const contentVector = SEARCH_VECTOR_BY_LANGUAGE[input.language];
  const tsQuery = sql`websearch_to_tsquery(${config}, ${input.query})`;

  const found = yield* await ctx.db.run((db) =>
    db
      .select({
        displayName: file.displayName,
        fileId: file.id,
        page: fileContent.page,
        snippet: sql<string>`ts_headline(${config}, ${fileContent.content}, ${tsQuery}, ${HEADLINE_OPTIONS})`,
      })
      .from(fileContent)
      .innerJoin(file, eq(file.id, fileContent.fileId))
      .where(
        and(
          eq(file.topicId, input.topicId),
          eq(file.status, "ready"),
          input.fileId ? eq(file.id, input.fileId) : undefined,
          sql`${contentVector} @@ ${tsQuery}`,
        ),
      )
      .orderBy(desc(sql`ts_rank_cd(${contentVector}, ${tsQuery})`))
      .limit(input.limit),
  );

  return Result.ok({
    matches: found.map((row) => ({
      fileKey: getMentionKey({ type: "file", value: rawId(row.fileId) }),
      displayName: row.displayName,
      page: row.page ?? undefined,
      snippet: row.snippet,
    })),
  });
});

const inputSchema = v.object({
  language: v.pipe(
    languageSchema,
    v.description(
      'Language the files are written in, which is not always the language the user writes in. Anything but English is `"other"`.',
    ),
  ),
  query: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description("Postgres full text search query, in `websearch_to_tsquery` syntax."),
  ),
  fileKey: v.optional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description(
        `Limits the search to one file, by its mention key in the shape ${mentionKeyFormat(["file"])}.`,
      ),
    ),
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

const outputSchema = v.variant("type", [
  v.object({
    type: v.literal("matches"),
    matches: v.array(
      v.object({
        fileKey: v.string(),
        displayName: v.string(),
        page: v.optional(
          v.pipe(
            v.number(),
            v.description(
              "Position in the file, 1-based, not the number printed on the page. Only when the format has pages.",
            ),
          ),
        ),
        snippet: v.string(),
      }),
    ),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type SearchFilesOutput = v.InferOutput<typeof outputSchema>;

const searchFilesCtx = Kit.createContext(dbKit);

export const searchFilesTool = createTool({
  id: "search-files",
  description:
    "Postgres full-text search over the pages of the current topic's files: tsvector matching, stemmed for English, ranked with ts_rank_cd, one ts_headline snippet per matching page.",
  inputExamples: [{ input: { language: "english", query: '"working capital" OR liquidity' } }],
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async (
    { fileKey, language, limit = DEFAULT_LIMIT, query },
    { requestContext },
  ): Promise<SearchFilesOutput> => {
    const topicId = requestContext.get("filter")?.topicId;

    if (!topicId) {
      panic("Missing topicId in request context");
    }

    const mention = fileKey ? parseMentionKey(fileKey) : undefined;

    if (mention && mention.type !== "file") {
      return { type: "error", message: `"${fileKey}" is not a topic file.` };
    }

    const result = await searchAgentFilesFn(searchFilesCtx, {
      // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with the topicId filter.
      fileId: mention ? toSafeId<"file">(mention.value) : undefined,
      language,
      limit,
      query,
      topicId,
    });

    if (Result.isError(result)) {
      throw new ToolError({ message: "Files could not be searched.", cause: result.error });
    }

    return { type: "matches", ...result.value };
  },
});
