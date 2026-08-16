import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, panic, Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import { LlmNativeMimeType } from "@/lib/file-validation";
import { getAttachment } from "@/lib/get-attachment.server";
import type { FetchedFile } from "@/lib/get-file.server";
import { getFile, toFileText } from "@/lib/get-file.server";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { mentionKeyShape, parseMentionKey } from "@/lib/mention-key";
import { s3Kit } from "@/lib/s3-kit.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";

const getFileCtx = Kit.createContext(dbKit, s3Kit);

const inputSchema = v.object({
  fileKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      `Mention key of the file to read, in the shape ${mentionKeyShape(["file", "attachment"])}.`,
    ),
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
  if (LlmNativeMimeType.is(file.mimeType)) {
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
    return { type: "error", message: text.error.message } satisfies GetFileToolError;
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
  if (output.type === "text") {
    return {
      type: "text",
      value: output.content,
    };
  }

  if (output.type === "error") {
    return {
      type: "text",
      value: output.message,
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

export const getFileTool = createTool({
  id: "get-file",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Reads one file's contents into the conversation.",
    "PDFs and images come back for direct inspection, other files as plain text.",
  ].join(" "),
  execute: async ({ fileKey }, context) => {
    const mention = parseMentionKey(fileKey);

    if (mention.type === "file") {
      const topicId = context.requestContext?.get("filter")?.topicId;

      if (!topicId) {
        panic("Missing topicId in request context");
      }

      const result = await getFile(getFileCtx, {
        fileId: mention.value,
        topicId,
      });

      if (Result.isError(result)) {
        return matchError(result.error, {
          GetFileError: (error): GetFileToolError => ({ type: "error", message: error.message }),
          DatabaseError: (cause) => {
            throw new ToolError({ message: "File could not be loaded.", cause });
          },
          S3Error: (cause) => {
            throw new ToolError({ message: "File could not be loaded.", cause });
          },
        });
      }

      return toToolOutput(result.value);
    }

    if (mention.type === "attachment") {
      const threadId = context.requestContext?.get("threadId");

      if (!threadId) {
        panic("Missing threadId in request context");
      }

      const result = await getAttachment(Kit.createContext(memoryKit), {
        flushMessages: context.agent?.flushMessages,
        sha256: mention.value,
        threadId,
      });

      if (Result.isError(result)) {
        return matchError(result.error, {
          GetAttachmentError: (error): GetFileToolError => ({
            type: "error",
            message: error.message,
          }),
          MemoryError: (cause) => {
            throw new ToolError({ message: "File could not be loaded.", cause });
          },
        });
      }

      return toToolOutput(result.value);
    }

    return {
      type: "error",
      message: `"${fileKey}" is not a usable file reference.`,
    } satisfies GetFileToolError;
  },
  toModelOutput,
});
