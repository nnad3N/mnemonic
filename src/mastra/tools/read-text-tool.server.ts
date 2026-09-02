import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { ImageMimeType } from "@/lib/file-validation";
import { toFileText } from "@/lib/get-file.server";
import { mentionKeyFormat } from "@/lib/mention-key";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { extractSchema, loadMentionedFile } from "@/mastra/tools/file-tool-helpers.server";

const inputSchema = v.object({
  fileKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      `Mention key of the file, in the shape ${mentionKeyFormat(["file", "attachment"])}.`,
    ),
  ),
  extract: extractSchema,
  pages: v.optional(
    v.pipe(
      v.boolean(),
      v.description(
        "Marks page boundaries in the text with `<!-- PAGE n -->`, where n is the position in the file, 1-based, not the number printed on the page. Paginated formats only, such as PDF.",
      ),
    ),
  ),
});

const outputSchema = v.variant("type", [
  v.object({
    type: v.literal("text"),
    content: v.string(),
    displayName: v.pipe(v.string(), v.nonEmpty()),
    mimeType: v.pipe(v.string(), v.nonEmpty()),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type ReadTextOutput = v.InferOutput<typeof outputSchema>;

const toModelOutput = (output: ReadTextOutput): ToolResultOutput => ({
  type: "text",
  value: output.type === "text" ? output.content : output.message,
});

export const readTextTool = createTool({
  id: "read-text",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description:
    "Reads one file. Text formats come back as their source; other formats are converted to text; images have none to extract.",
  execute: async ({ fileKey, extract, pages }, context): Promise<ReadTextOutput> => {
    const file = await loadMentionedFile({ fileKey, requestContext: context.requestContext });

    if (Result.isError(file)) {
      return { type: "error", message: file.error.message };
    }

    if (ImageMimeType.is(file.value.mimeType)) {
      return { type: "error", message: "The file is an image; it has no text to extract." };
    }

    const text = await toFileText(file.value, { extract, pages });

    if (Result.isError(text)) {
      return { type: "error", message: text.error.message };
    }

    return {
      type: "text",
      content: text.value,
      displayName: file.value.displayName,
      mimeType: file.value.mimeType,
    };
  },
  toModelOutput,
});
