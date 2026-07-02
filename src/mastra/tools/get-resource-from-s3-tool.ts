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
import { getObject } from "@/lib/s3";
import { toSafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";

const inputSchema = v.object({
  resourceId: v.pipe(v.string(), v.nanoid()),
});

const successOutputSchema = v.object({
  type: v.literal("success"),
  resourceId: v.pipe(v.string(), v.nanoid()),
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

type GetResourceSuccess = v.InferOutput<typeof successOutputSchema>;
type GetResourceError = v.InferOutput<typeof errorOutputSchema>;

export const getResourceFromS3Tool = createTool({
  id: "get-resource-from-s3",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Load one supported raw uploaded resource from the current topic for direct multimodal inspection.",
    "Use for images, which are not text-indexed, or when the user @-mentions a specific supported image resource.",
    "Do not use for office documents, PDFs, or other extracted-only uploads; use resource-vector-search or resource-graph-rag for those.",
    `Supported MIME types: ${LLM_NATIVE_IMAGE_MIME_TYPES.join(", ")}.`,
    "Input resourceId must come from an resource @-mention or prior tool result.",
  ].join(" "),
  execute: async ({ resourceId }, context) => {
    const topicId = context.requestContext?.get("filter")?.topicId;

    if (!topicId) {
      return {
        type: "error",
        message: "Resource not found.",
      } satisfies GetResourceError;
    }

    const resource = await db.query.resource.findFirst({
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
        id: toSafeId<"resource">(resourceId),
        topicId,
      },
    });

    if (!resource || resource.status !== "ready") {
      return {
        type: "error",
        message: "Resource not found.",
      } satisfies GetResourceError;
    }

    if (!isLLMNativeImageMimeType(resource.mimeType)) {
      return {
        type: "error",
        message: `File "${resource.displayName}" (${resource.mimeType}) cannot be loaded directly. Use vector or graph search instead.`,
      } satisfies GetResourceError;
    }

    const objectResult = await getObject(resource.s3Key);

    if (Result.isError(objectResult)) {
      return {
        type: "error",
        message: "Resource could not be loaded.",
      } satisfies GetResourceError;
    }

    return {
      type: "success",
      resourceId: resource.id,
      data: Buffer.from(objectResult.value).toString("base64"),
      displayName: resource.displayName,
      mimeType: resource.mimeType,
      sizeBytes: resource.sizeBytes,
    } satisfies GetResourceSuccess;
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
