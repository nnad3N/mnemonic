import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import type { Document, SearchResultWeb } from "firecrawl";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import { FIRECRAWL_SEARCH_TIMEOUT_MS, firecrawl } from "@/mastra/tools/firecrawl-client.server";

const SEARCH_LIMIT = 5;

const inputSchema = v.object({
  query: v.pipe(v.string(), v.nonEmpty()),
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
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: "Searches the live web; results include the search engine's description snippet.",
  execute: async ({ query }) => {
    const searchResult = await Result.tryPromise(async () =>
      firecrawl.search(query, { limit: SEARCH_LIMIT, timeout: FIRECRAWL_SEARCH_TIMEOUT_MS }),
    );

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
