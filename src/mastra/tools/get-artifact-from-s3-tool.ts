import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { db } from "@/db";
import { LLM_NATIVE_IMAGE_MIME_TYPES } from "@/lib/llm-native-mime-types";
import { getObject } from "@/lib/s3";
import { isImageMimeType } from "@/lib/supported-files";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";

const inputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
});

const successOutputSchema = v.object({
  type: v.literal("success"),
  artifactId: v.pipe(v.string(), v.nanoid()),
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

type GetArtifactSuccess = v.InferOutput<typeof successOutputSchema>;
type GetArtifactError = v.InferOutput<typeof errorOutputSchema>;

export const getArtifactFromS3Tool = createTool({
  id: "get-artifact-from-s3",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Load a raw uploaded artifact from storage for direct multimodal inspection.",
    "Use for images (not text-indexed) or as a fallback when artifact-vector-search and artifact-graph-rag did not answer.",
    "Do NOT use for office documents or other extracted-only uploads — use the search tools instead.",
    `Supported MIME types: ${LLM_NATIVE_IMAGE_MIME_TYPES.join(", ")}.`,
    "Input: artifactId from @-mentions or prior tool results.",
  ].join(" "),
  execute: async ({ artifactId }, context) => {
    const topicId = context.requestContext?.get("filter")?.topicId;

    const artifact = await db.query.artifact.findFirst({
      columns: {
        displayName: true,
        id: true,
        mimeType: true,
        s3Key: true,
        sizeBytes: true,
        status: true,
      },
      where: {
        id: artifactId,
        topicId,
      },
    });

    if (!artifact || artifact.status !== "ready") {
      return {
        type: "error",
        message: "Artifact not found.",
      } satisfies GetArtifactError;
    }

    if (!LLM_NATIVE_IMAGE_MIME_TYPES.includes(artifact.mimeType)) {
      return {
        type: "error",
        message: `File "${artifact.displayName}" (${artifact.mimeType}) cannot be loaded directly. Use vector or graph search instead.`,
      } satisfies GetArtifactError;
    }

    const objectResult = await getObject({ key: artifact.s3Key });

    if (Result.isError(objectResult)) {
      return {
        type: "error",
        message: objectResult.error.message,
      } satisfies GetArtifactError;
    }

    return {
      type: "success",
      artifactId: artifact.id,
      data: Buffer.from(objectResult.value).toString("base64"),
      displayName: artifact.displayName,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
    } satisfies GetArtifactSuccess;
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
