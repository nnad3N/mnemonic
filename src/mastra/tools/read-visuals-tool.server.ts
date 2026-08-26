import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import { ImageMimeType } from "@/lib/file-validation";
import { mentionKeyFormat } from "@/lib/mention-key";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import {
  extractFile,
  loadMentionedFile,
  visualSchema,
} from "@/mastra/tools/file-tool-helpers.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";

const inputSchema = v.object({
  fileKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      `Mention key of the file, in the shape ${mentionKeyFormat(["file", "attachment"])}.`,
    ),
  ),
});

const outputSchema = v.variant("type", [
  v.object({
    type: v.literal("visuals"),
    displayName: v.pipe(v.string(), v.nonEmpty()),
    visuals: v.array(visualSchema),
    skipped: v.pipe(v.number(), v.description("Embedded images in formats the model cannot view.")),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type ReadVisualsOutput = v.InferOutput<typeof outputSchema>;

const toModelOutput = (output: ReadVisualsOutput): ToolResultOutput => {
  if (output.type === "error") {
    return { type: "text", value: output.message };
  }

  if (output.visuals.length === 0) {
    return {
      type: "text",
      value:
        output.skipped === 0
          ? `${output.displayName} contains no images.`
          : `${output.displayName} contains ${output.skipped} image(s), none in a viewable format.`,
    };
  }

  return {
    type: "content",
    value: output.visuals.flatMap((visual) => [
      ...(visual.page === undefined
        ? []
        : [{ type: "text" as const, text: `Page ${visual.page}:` }]),
      {
        type: "file" as const,
        mediaType: visual.mimeType,
        filename: output.displayName,
        data: { type: "data" as const, data: visual.data },
      },
    ]),
  };
};

export const readVisualsTool = createTool({
  id: "read-visuals",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: "Reads the images in one file; an image file comes back as itself.",
  execute: async ({ fileKey }, context): Promise<ReadVisualsOutput> => {
    const file = await loadMentionedFile({ fileKey, requestContext: context.requestContext });

    if (Result.isError(file)) {
      return { type: "error", message: file.error.message };
    }

    const { bytes, displayName, mimeType } = file.value;

    if (ImageMimeType.is(mimeType)) {
      return {
        type: "visuals",
        displayName,
        visuals: [{ data: Buffer.from(bytes).toString("base64"), mimeType }],
        skipped: 0,
      };
    }

    const extracted = await extractFile(bytes, mimeType);

    if (Result.isError(extracted)) {
      throw new ToolError({
        message: "File contents could not be extracted.",
        cause: extracted.error,
      });
    }

    return { type: "visuals", displayName, ...extracted.value };
  },
  toModelOutput,
});
