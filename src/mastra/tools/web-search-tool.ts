import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import type { Document, SearchResultWeb } from "firecrawl";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import { firecrawl } from "@/mastra/tools/firecrawl-client";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema";

const DEFAULT_SEARCH_LIMIT = 10;

const inputSchema = v.object({
  query: v.pipe(v.string(), v.nonEmpty()),
  limit: v.optional(
    v.pipe(
      v.number(),
      v.minValue(1),
      v.maxValue(25),
      v.description(`Defaults to ${DEFAULT_SEARCH_LIMIT}.`),
    ),
  ),
});

const searchResultSchema = v.object({
  url: v.pipe(v.string(), v.nonEmpty()),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
});

const outputSchema = v.object({
  query: v.pipe(v.string(), v.nonEmpty()),
  results: v.array(searchResultSchema),
});

type WebSearchOutput = v.InferOutput<typeof outputSchema>;
type WebSearchResult = v.InferOutput<typeof searchResultSchema>;

const isWebResult = (item: SearchResultWeb | Document): item is SearchResultWeb =>
  !("html" in item);

export const toSearchResult = (item: SearchResultWeb | Document): WebSearchResult | undefined => {
  if (!isWebResult(item) || !item.url) return;

  return {
    url: item.url,
    title: item.title,
    description: item.description,
  };
};

export const webSearchTool = createTool({
  id: "web-search",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: "Searches the live web; results include the search engine's description snippet.",
  execute: async ({ query, limit = DEFAULT_SEARCH_LIMIT }) => {
    const searchResult = await Result.tryPromise(async () => firecrawl.search(query, { limit }));

    if (Result.isError(searchResult)) {
      throw new ToolError({
        message: "Web search failed.",
        cause: searchResult.error,
      });
    }

    const results =
      searchResult.value.web
        ?.map((item) => toSearchResult(item))
        .filter((item) => item !== undefined) ?? [];

    return {
      query,
      results,
    } satisfies WebSearchOutput;
  },
});
