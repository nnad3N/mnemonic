import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import {
  isImageMimeType,
  isLLMNativeImageMimeType,
  LLM_NATIVE_IMAGE_MIME_TYPES,
} from "@/lib/file-validation";
import { Kit } from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { s3Kit } from "@/lib/s3-kit";
import type { S3Kit } from "@/lib/s3-kit";
import { toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";

const inputSchema = v.object({
  fileId: v.pipe(
    v.string(),
    v.nanoid(),
    v.description("File ID from a file @-mention or a prior tool result in the current topic."),
  ),
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

const outputSchema = v.variant("type", [successOutputSchema, errorOutputSchema]);

type GetFileSuccess = v.InferOutput<typeof successOutputSchema>;
type GetFileError = v.InferOutput<typeof errorOutputSchema>;

type GetFileInput = {
  fileId: string;
  topicId?: SafeId<"topic">;
};

type GetFileCtx = Kits<[DbKit, S3Kit]>;

const getFileFn = Kit.gen(async function* (ctx: GetFileCtx, input: GetFileInput) {
  if (!input.topicId) {
    return Result.ok({
      type: "error",
      message: "File not found.",
    } satisfies GetFileError);
  }

  const row = yield* await ctx.db.run((db) =>
    db.query.file.findFirst({
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
        id: toSafeId<"file">(input.fileId),
        topicId: input.topicId,
      },
    }),
  );

  if (!row || row.status !== "ready") {
    return Result.ok({
      type: "error",
      message: "File not found.",
    } satisfies GetFileError);
  }

  if (!isLLMNativeImageMimeType(row.mimeType)) {
    return Result.ok({
      type: "error",
      message: `File "${row.displayName}" (${row.mimeType}) cannot be loaded directly. Use vector or graph search instead.`,
    } satisfies GetFileError);
  }

  const object = yield* await ctx.s3.getObject(row.s3Key);

  return Result.ok({
    type: "success",
    fileId: row.id,
    data: Buffer.from(object).toString("base64"),
    displayName: row.displayName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
  } satisfies GetFileSuccess);
});

const getFileCtx = Kit.createContext(dbKit, s3Kit);

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
  ].join(" "),
  execute: async ({ fileId }, context) => {
    const result = await getFileFn(getFileCtx, {
      fileId,
      topicId: context.requestContext?.get("filter")?.topicId,
    });

    if (Result.isError(result)) {
      return {
        type: "error",
        message: "File could not be loaded.",
      } satisfies GetFileError;
    }

    return result.value;
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
