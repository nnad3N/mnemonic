import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { db } from "@/db";
import {
  isImageMimeType,
  isLLMNativeImageMimeType,
  LLM_NATIVE_IMAGE_MIME_TYPES,
} from "@/lib/file-validation";
import { Kit } from "@/lib/kit";
import { s3Kit } from "@/lib/s3-kit";
import { toSafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";

const inputSchema = v.object({
  fileId: v.pipe(v.string(), v.nanoid()),
});

const successOutputSchema = v.object({
  type: v.literal("success"),
  fileId: v.pipe(v.string(), v.nanoid()),
  data: v.pipe(v.string(), v.nonEmpty()),
  displayName: v.pipe(v.string(), v.nonEmpty()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  sizeBytes: v.pipe(v.number(), v.minValue(1)),
});

const errorOutputSchema = v.object({
  type: v.literal("error"),
  message: v.string(),
});

const outputSchema = v.variant("type", [
  successOutputSchema,
  errorOutputSchema,
]);

type GetFileSuccess = v.InferOutput<typeof successOutputSchema>;
type GetFileError = v.InferOutput<typeof errorOutputSchema>;

export const getFileFromS3Tool = createTool({
  id: "get-file-from-s3",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Load one supported raw uploaded file from the current topic for direct multimodal inspection.",
    "Use for images, which are not text-indexed, or when the user @-mentions a specific supported image file.",
    "Do not use for office documents, PDFs, or other extracted-only uploads; use fileVectorSearch or fileGraphRag for those.",
    `Supported MIME types: ${LLM_NATIVE_IMAGE_MIME_TYPES.join(", ")}.`,
    "Input fileId must come from a file @-mention or prior tool result.",
  ].join(" "),
  execute: async ({ fileId }, context) => {
    const topicId = context.requestContext?.get("filter")?.topicId;

    if (!topicId) {
      return {
        type: "error",
        message: "File not found.",
      } satisfies GetFileError;
    }

    const row = await db.query.file.findFirst({
      columns: {
        displayName: true,
        id: true,
        mimeType: true,
        s3Key: true,
        sizeBytes: true,
        status: true,
      },
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- scoped by trusted topic.
        id: toSafeId<"file">(fileId),
        topicId,
      },
    });

    if (!row || row.status !== "ready") {
      return {
        type: "error",
        message: "File not found.",
      } satisfies GetFileError;
    }

    if (!isLLMNativeImageMimeType(row.mimeType)) {
      return {
        type: "error",
        message: `File "${row.displayName}" (${row.mimeType}) cannot be loaded directly. Use vector or graph search instead.`,
      } satisfies GetFileError;
    }

    const objectResult = await Kit.get(s3Kit).getObject(row.s3Key);

    if (Result.isError(objectResult)) {
      return {
        type: "error",
        message: "File could not be loaded.",
      } satisfies GetFileError;
    }

    return {
      type: "success",
      fileId: row.id,
      data: Buffer.from(objectResult.value).toString("base64"),
      displayName: row.displayName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
    } satisfies GetFileSuccess;
  },
  toModelOutput: (output): ToolResultOutput => {
    if (output.type === "error") {
      return {
        type: "text",
        value: output.message,
      };
    }

    const intro = {
      text: `Loaded file "${output.displayName}" (${output.mimeType}, ${output.sizeBytes} bytes).`,
      type: "text",
    } as const;

    if (isImageMimeType(output.mimeType)) {
      return {
        type: "content",
        value: [
          intro,
          {
            data: output.data,
            mediaType: output.mimeType,
            type: "image-data",
          },
        ],
      };
    }

    return {
      type: "content",
      value: [
        intro,
        {
          data: output.data,
          filename: output.displayName,
          mediaType: output.mimeType,
          type: "file-data",
        },
      ],
    };
  },
});
