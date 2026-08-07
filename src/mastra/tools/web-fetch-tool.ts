import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import { firecrawl } from "@/mastra/tools/firecrawl-client";

const inputSchema = v.object({
  url: v.pipe(
    v.string(),
    v.url(),
    v.description("Absolute http(s) URL of the page to fetch and read as markdown."),
  ),
});

const outputSchema = v.object({
  url: v.pipe(v.string(), v.nonEmpty()),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  markdown: v.pipe(v.string(), v.nonEmpty()),
});

type WebFetchOutput = v.InferOutput<typeof outputSchema>;

export const webFetchTool = createTool({
  id: "web-fetch",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: [
    "Fetch one specific URL and return its main content as markdown.",
    "Use when the user pastes a URL, or when a prior search already identified the exact page to read (GitHub README, docs page, blog post, etc.).",
    "Do not use for open-ended discovery without a URL; use webSearch first.",
    "Returns the page title, description when available, and markdown body. If the page cannot be fetched, try another URL from search results.",
  ].join(" "),
  execute: async ({ url }) => {
    const documentResult = await Result.tryPromise(async () =>
      firecrawl.scrape(url, {
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    );

    if (Result.isError(documentResult)) {
      throw new ToolError({
        message: "Could not fetch that URL. Check the link or search for an alternative page.",
        cause: documentResult.error,
      });
    }

    const document = documentResult.value;
    const markdown = document.markdown?.trim();

    if (!markdown) {
      throw new ToolError({
        message: "The page was reached but no readable content was extracted. Try a different URL.",
      });
    }

    return {
      url: document.metadata?.sourceURL ?? document.metadata?.url ?? url,
      title: document.metadata?.title,
      description: document.metadata?.description,
      markdown,
    } satisfies WebFetchOutput;
  },
});
