import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import MarkdownIt from "markdown-it";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
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

const fetchUrl = async (url: string): Promise<WebFetchSuccess | WebFetchError> => {
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
};

export const webFetchTool = createTool({
  id: "web-fetch",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: "Fetches one URL and returns its main content as markdown.",
  execute: async ({ url }) => fetchUrl(url),
});

const markdownIt = new MarkdownIt({ linkify: true });

const extractLinkUrls = (markdown: string): string[] => {
  const urls: string[] = [];

  for (const token of markdownIt.parse(markdown, {})) {
    if (token.type !== "inline") {
      continue;
    }

    for (const child of token.children ?? []) {
      if (child.type !== "link_open") {
        continue;
      }

      const href = child.attrGet("href");

      if (href !== null) {
        urls.push(String(href));
      }
    }
  }

  return urls;
};

export const isUserProvidedUrl = (url: string, texts: string[]): boolean => {
  const target = new URL(url).href;

  return texts
    .flatMap(extractLinkUrls)
    .some((href) => URL.canParse(href) && new URL(href).href === target);
};

export const userLinkWebFetchTool = createTool({
  id: "user-link-web-fetch",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description:
    "Fetches one URL and returns its main content as markdown. Only a link the user wrote in this conversation can be fetched.",
  execute: async ({ url }, { requestContext }) => {
    const listed = await Kit.get(memoryKit).listMessages({
      threadId: requestContext.get("threadId"),
      page: 0,
      perPage: false,
    });

    if (Result.isError(listed)) {
      throw new ToolError({ message: "User messages could not be read.", cause: listed.error });
    }

    const texts = listed.value.messages
      .filter((message) => message.role === "user")
      .flatMap((message) => message.content.parts)
      .filter((part) => part.type === "text")
      .map((part) => part.text);

    if (!isUserProvidedUrl(url, texts)) {
      return {
        type: "error",
        url,
        message:
          "Not a link the user provided. Only links from the user's messages can be fetched.",
      } satisfies WebFetchError;
    }

    return fetchUrl(url);
  },
});
