import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import type { Document, SearchResultWeb } from "firecrawl";
import * as v from "valibot";

import { firecrawl } from "@/mastra/tools/firecrawl-client";

const DEFAULT_SEARCH_LIMIT = 10;

const inputSchema = v.object({
  query: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description("Concrete search string for open-web discovery."),
  ),
  limit: v.optional(
    v.pipe(
      v.number(),
      v.minValue(1),
      v.maxValue(25),
      v.description(`Maximum number of results to return. Defaults to ${DEFAULT_SEARCH_LIMIT}.`),
    ),
  ),
});

const searchResultSchema = v.object({
  url: v.pipe(v.string(), v.nonEmpty()),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  markdown: v.optional(v.string()),
});

const successOutputSchema = v.object({
  type: v.literal("success"),
  query: v.pipe(v.string(), v.nonEmpty()),
  results: v.array(searchResultSchema),
});

const errorOutputSchema = v.object({
  type: v.literal("error"),
  message: v.string(),
});

const outputSchema = v.variant("type", [successOutputSchema, errorOutputSchema]);

type WebSearchSuccess = v.InferOutput<typeof successOutputSchema>;
type WebSearchError = v.InferOutput<typeof errorOutputSchema>;
type WebSearchResult = v.InferOutput<typeof searchResultSchema>;

const isDocumentResult = (item: SearchResultWeb | Document): item is Document => "html" in item;

export const toSearchResult = (item: SearchResultWeb | Document): WebSearchResult | undefined => {
  if (isDocumentResult(item)) {
    const url = item.metadata?.sourceURL ?? item.metadata?.url;
    if (!url) return;

    return {
      url,
      title: item.metadata?.title,
      description: item.metadata?.description,
      markdown: item.markdown,
    };
  }

  if (!item.url) return;

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
  description: [
    "Search the live web and return ranked pages with scraped markdown content when available.",
    "Use for open-ended research, current events, documentation discovery, or when the user asks to search the web and no specific URL is known yet.",
    "Do not use when the user already provided a concrete URL to read; use webFetch for that.",
    "Returns title, url, description, and markdown per result. Results may be partial or empty if pages fail to scrape; try a tighter query or webFetch on a promising URL.",
  ].join(" "),
  execute: async ({ query, limit = DEFAULT_SEARCH_LIMIT }) => {
    const searchResult = await Result.tryPromise(async () =>
      firecrawl.search(query, {
        limit,
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
        },
      }),
    );

    if (Result.isError(searchResult)) {
      return {
        type: "error",
        message: "Web search failed. Try a different query or fetch a specific URL with webFetch.",
      } satisfies WebSearchError;
    }

    const results =
      searchResult.value.web
        ?.map((item) => toSearchResult(item))
        .filter((item) => item !== undefined) ?? [];

    return {
      type: "success",
      query,
      results,
    } satisfies WebSearchSuccess;
  },
});
