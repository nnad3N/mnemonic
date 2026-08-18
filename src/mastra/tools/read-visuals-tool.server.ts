import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { detectMimeType, extractBytes } from "@kreuzberg/node";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import { ImageMimeType, LlmNativeMimeType } from "@/lib/file-validation";
import { mentionKeyShape } from "@/lib/mention-key";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { loadMentionedFile } from "@/mastra/tools/mentioned-file.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";

const inputSchema = v.object({
  fileKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      `Mention key of the file, in the shape ${mentionKeyShape(["file", "attachment"])}.`,
    ),
  ),
});

const visualSchema = v.object({
  data: v.pipe(v.string(), v.nonEmpty(), v.description("Base64.")),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  page: v.optional(v.number()),
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

type Visual = v.InferOutput<typeof visualSchema>;
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
  description:
    "Reads one file for direct viewing: a PDF or image comes back whole, any other file comes back as the images embedded in it.",
  execute: async ({ fileKey }, context): Promise<ReadVisualsOutput> => {
    const file = await loadMentionedFile({ fileKey, requestContext: context.requestContext });

    if (Result.isError(file)) {
      return { type: "error", message: file.error.message };
    }

    const { bytes, displayName, mimeType } = file.value;

    if (LlmNativeMimeType.is(mimeType)) {
      return {
        type: "visuals",
        displayName,
        visuals: [{ data: Buffer.from(bytes).toString("base64"), mimeType }],
        skipped: 0,
      };
    }

    const extraction = await Result.tryPromise(async () =>
      extractBytes(Buffer.from(bytes), mimeType, { images: { extractImages: true } }),
    );

    if (Result.isError(extraction)) {
      throw new ToolError({ message: "File could not be loaded.", cause: extraction.error });
    }

    const visuals: Visual[] = [];
    let skipped = 0;

    for (const image of extraction.value.images ?? []) {
      const imageMimeType = detectMimeType(Buffer.from(image.data));

      if (!ImageMimeType.is(imageMimeType)) {
        skipped += 1;
        continue;
      }

      visuals.push({
        data: Buffer.from(image.data).toString("base64"),
        mimeType: imageMimeType,
        page: image.pageNumber ?? undefined,
      });
    }

    return { type: "visuals", displayName, visuals, skipped };
  },
  toModelOutput,
});
