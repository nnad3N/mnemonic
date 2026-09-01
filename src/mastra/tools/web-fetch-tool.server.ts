import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { FIRECRAWL_SCRAPE_TIMEOUT_MS, firecrawl } from "@/mastra/tools/firecrawl-client.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";

const inputSchema = v.object({
  url: v.pipe(v.string(), v.url()),
});

const successOutputSchema = v.object({
  type: v.literal("success"),
  url: v.pipe(v.string(), v.nonEmpty()),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  markdown: v.pipe(v.string(), v.nonEmpty()),
});

const errorOutputSchema = v.object({
  type: v.literal("error"),
  url: v.pipe(v.string(), v.nonEmpty()),
  message: v.string(),
});

const outputSchema = v.variant("type", [successOutputSchema, errorOutputSchema]);

type WebFetchSuccess = v.InferOutput<typeof successOutputSchema>;
type WebFetchError = v.InferOutput<typeof errorOutputSchema>;

export const webFetchTool = createTool({
  id: "web-fetch",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: "Fetches one URL and returns its main content as markdown.",
  execute: async ({ url }) => {
    const documentResult = await Result.tryPromise(async () =>
      firecrawl.scrape(url, {
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: FIRECRAWL_SCRAPE_TIMEOUT_MS,
      }),
    );

    if (Result.isError(documentResult)) {
      return {
        type: "error",
        url,
        message: "Could not fetch that URL. Check the link or search for an alternative page.",
      } satisfies WebFetchError;
    }

    const document = documentResult.value;
    const markdown = document.markdown?.trim();

    if (!markdown) {
      return {
        type: "error",
        url,
        message: "The page was reached but no readable content was extracted. Try a different URL.",
      } satisfies WebFetchError;
    }

    return {
      type: "success",
      url: document.metadata?.sourceURL ?? document.metadata?.url ?? url,
      title: document.metadata?.title,
      description: document.metadata?.description,
      markdown,
    } satisfies WebFetchSuccess;
  },
});
