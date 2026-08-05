import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit";
import { isLLMNativeMimeType } from "@/lib/file-validation";
import { getAttachment } from "@/lib/get-attachment";
import type { FetchedFile } from "@/lib/get-file";
import { getFile, toFileText } from "@/lib/get-file";
import { Kit } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import { parseMentionKey } from "@/lib/mention-key";
import { s3Kit } from "@/lib/s3-kit";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";

const getFileCtx = Kit.createContext(dbKit, s3Kit);

const inputSchema = v.object({
  fileKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description("Mention key in the shape `TYPE::STRING`."),
  ),
});

const fileOutputSchema = v.object({
  type: v.literal("file"),
  fileId: v.pipe(v.string(), v.nonEmpty()),
  data: v.pipe(v.string(), v.nonEmpty()),
  displayName: v.pipe(v.string(), v.nonEmpty()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  sizeBytes: v.pipe(v.number(), v.minValue(1)),
});

const textOutputSchema = v.object({
  type: v.literal("text"),
  fileId: v.pipe(v.string(), v.nonEmpty()),
  content: v.string(),
  displayName: v.pipe(v.string(), v.nonEmpty()),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
});

const errorOutputSchema = v.object({
  type: v.literal("error"),
  message: v.string(),
});

const outputSchema = v.variant("type", [fileOutputSchema, textOutputSchema, errorOutputSchema]);

type GetFileToolFile = v.InferOutput<typeof fileOutputSchema>;
type GetFileToolText = v.InferOutput<typeof textOutputSchema>;
type GetFileToolError = v.InferOutput<typeof errorOutputSchema>;

const toToolOutput = async (
  file: FetchedFile,
): Promise<GetFileToolFile | GetFileToolText | GetFileToolError> => {
  if (isLLMNativeMimeType(file.mimeType)) {
    return {
      type: "file",
      fileId: file.fileId,
      data: Buffer.from(file.bytes).toString("base64"),
      displayName: file.displayName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    } satisfies GetFileToolFile;
  }

  const text = await toFileText(file);

  if (Result.isError(text)) {
    return {
      type: "error",
      message: text.error.message,
    } satisfies GetFileToolError;
  }

  return {
    type: "text",
    fileId: file.fileId,
    content: text.value,
    displayName: file.displayName,
    mimeType: file.mimeType,
  } satisfies GetFileToolText;
};

const toModelOutput = (output: v.InferOutput<typeof outputSchema>): ToolResultOutput => {
  if (output.type === "error") {
    return {
      type: "error-text",
      value: output.message,
    };
  }

  if (output.type === "text") {
    return {
      type: "text",
      value: output.content,
    };
  }

  return {
    type: "content",
    value: [
      {
        type: "file",
        mediaType: output.mimeType,
        filename: output.displayName,
        data: {
          type: "data",
          data: output.data,
        },
      },
    ],
  };
};

const notFound = (): GetFileToolError => ({
  type: "error",
  message: "File not found.",
});

export const getFileTool = createTool({
  id: "get-file",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Load one file by mention key in the shape `TYPE::STRING`.",
    "PDF and supported images are returned for direct multimodal inspection; other supported files are returned as extracted plain text.",
    "Returns an error if the file is missing, inaccessible, or oversized.",
  ].join(" "),
  execute: async ({ fileKey }, context) => {
    const mention = parseMentionKey(fileKey);

    if (mention.type === "file") {
      const topicId = context.requestContext?.get("filter")?.topicId;

      if (!topicId) {
        return notFound();
      }

      const result = await getFile(getFileCtx, {
        fileId: mention.value,
        topicId,
      });

      if (Result.isError(result)) {
        return {
          type: "error",
          message: matchError(result.error, {
            GetFileError: (error) => error.message,
            DatabaseError: () => "File could not be loaded.",
            S3Error: () => "File could not be loaded.",
          }),
        } satisfies GetFileToolError;
      }

      return toToolOutput(result.value);
    }

    if (mention.type === "attachment") {
      const threadId = context.requestContext?.get("threadId");

      if (!threadId) {
        return notFound();
      }

      const result = await getAttachment(Kit.createContext(memoryKit), {
        flushMessages: context.agent?.flushMessages,
        sha256: mention.value,
        threadId,
      });

      if (Result.isError(result)) {
        return {
          type: "error",
          message: matchError(result.error, {
            GetAttachmentError: (error) => error.message,
            MemoryError: () => "File could not be loaded.",
          }),
        } satisfies GetFileToolError;
      }

      return toToolOutput(result.value);
    }

    return notFound();
  },
  toModelOutput,
});
