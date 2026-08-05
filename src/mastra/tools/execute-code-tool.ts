import type { RequestContext } from "@mastra/core/request-context";
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
import { runCode } from "@/lib/sandbox/run-code.ts";
import type { MnemonicRequestContext } from "@/mastra/request-context";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";

const getFileCtx = Kit.createContext(dbKit, s3Kit);

const jsonValueSchema = v.union([
  v.string(),
  v.number(),
  v.boolean(),
  v.record(v.string(), v.unknown()),
  v.array(v.unknown()),
  v.null(),
]);

const inputSchema = v.object({
  code: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      "JavaScript source to run in the sandbox. End with `export default <value>` so the tool returns that JSON-serializable value as `result`. Read structured input from `env.args`. When `fileKey` is set, read the loaded file from `env.file` (`contents`, `filename`, `size`, `mimeType`). PDF and image contents are data URLs; other file contents are text. Do not embed large file bodies in the source.",
    ),
  ),
  args: v.optional(
    v.pipe(
      jsonValueSchema,
      v.description(
        "JSON-serializable input available as `env.args`. Prefer this for small structured data.",
      ),
    ),
  ),
  fileKey: v.optional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description(
        "Optional mention key in the shape `TYPE::STRING`. When set, the host loads the referenced content into `env.file`; PDF and image contents are data URLs, while other contents are text. Omit when no referenced content is needed.",
      ),
    ),
  ),
});

const successOutputSchema = v.object({
  type: v.literal("success"),
  result: v.optional(jsonValueSchema),
  logs: v.optional(v.string()),
});

const errorOutputSchema = v.object({
  type: v.literal("error"),
  message: v.string(),
  name: v.optional(v.string()),
  isSyntaxError: v.optional(v.boolean()),
});

const outputSchema = v.variant("type", [successOutputSchema, errorOutputSchema]);

type ExecuteCodeSuccess = v.InferOutput<typeof successOutputSchema>;
type ExecuteCodeError = v.InferOutput<typeof errorOutputSchema>;

export type SandboxFile = {
  contents: string;
  filename: string;
  size: number;
  mimeType: string;
};

const toSandboxFile = async (
  file: FetchedFile,
): Promise<Result<SandboxFile, { message: string }>> => {
  if (isLLMNativeMimeType(file.mimeType)) {
    return Result.ok({
      contents: `data:${file.mimeType};base64,${Buffer.from(file.bytes).toString("base64")}`,
      filename: file.displayName,
      size: file.sizeBytes,
      mimeType: file.mimeType,
    });
  }

  const text = await toFileText(file);

  if (Result.isError(text)) {
    return Result.err({ message: text.error.message });
  }

  return Result.ok({
    contents: text.value,
    filename: file.displayName,
    size: file.sizeBytes,
    mimeType: file.mimeType,
  });
};

type LoadSandboxFileInput = {
  fileKey: string;
  flushMessages: (() => Promise<void>) | undefined;
  requestContext: RequestContext<MnemonicRequestContext> | undefined;
};

const loadSandboxFile = async ({
  fileKey,
  flushMessages,
  requestContext,
}: LoadSandboxFileInput): Promise<Result<SandboxFile, { message: string }>> => {
  const mention = parseMentionKey(fileKey);

  if (mention.type === "file") {
    const topicId = requestContext?.get("filter")?.topicId;

    if (!topicId) {
      return Result.err({ message: "File not found." });
    }

    const result = await getFile(getFileCtx, {
      fileId: mention.value,
      topicId,
    });

    if (Result.isError(result)) {
      return Result.err({
        message: matchError(result.error, {
          GetFileError: (error) => error.message,
          DatabaseError: () => "File could not be loaded.",
          S3Error: () => "File could not be loaded.",
        }),
      });
    }

    return toSandboxFile(result.value);
  }

  if (mention.type === "attachment") {
    const threadId = requestContext?.get("threadId");

    if (!threadId) {
      return Result.err({ message: "File not found." });
    }

    const result = await getAttachment(Kit.createContext(memoryKit), {
      flushMessages,
      sha256: mention.value,
      threadId,
    });

    if (Result.isError(result)) {
      return Result.err({
        message: matchError(result.error, {
          GetAttachmentError: (error) => error.message,
          MemoryError: () => "File could not be loaded.",
        }),
      });
    }

    return toSandboxFile(result.value);
  }

  return Result.err({ message: "File not found." });
};

export const executeCodeTool = createTool({
  id: "execute-code",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Executes code in an isolated ES6 JavaScript sandbox with no filesystem or network access.",
    "Use for calculations (prefer mathjs), data transforms, parsing, formatting, or quick algorithmic checks.",
    "Pass small structured input via `args` (read as `env.args`). To compute over referenced content, pass its optional mention key in the shape `TYPE::STRING` via `fileKey` and read `env.file` (`contents`, `filename`, `size`, `mimeType`). PDF and image contents are data URLs; other contents are text. Do not embed large content bodies in `code` or `args`.",
    "Missing, inaccessible, or oversized files return a tool error before the sandbox runs.",
    "You can use mathjs after importing it. If uncertain about available functions, check the official mathjs docs.",
    "The tool result is `export default` (JSON-serialized into `result`). Example: `export default { answer: value }`.",
    "On success, `result` is the default export and `logs` is console output. On failure, returns execution error details.",
  ].join(" "),
  execute: async ({ code, args, fileKey }, context) => {
    let file: SandboxFile | undefined;

    if (fileKey) {
      const result = await loadSandboxFile({
        fileKey,
        flushMessages: context.agent?.flushMessages,
        requestContext: context.requestContext,
      });

      if (Result.isError(result)) {
        return {
          type: "error",
          message: result.error.message,
        } satisfies ExecuteCodeError;
      }

      file = result.value;
    }

    const executionResult = await runCode(code, {
      args,
      file,
    });

    if (Result.isOk(executionResult)) {
      return {
        type: "success",
        result: executionResult.value.output,
        logs: executionResult.value.logs,
      } satisfies ExecuteCodeSuccess;
    }

    return matchError(executionResult.error, {
      SandboxExecuteError: (error) =>
        ({
          type: "error",
          name: error.name,
          message: error.message,
          isSyntaxError: error.isSyntaxError,
        }) satisfies ExecuteCodeError,
      SandboxInitError: () =>
        ({
          type: "error",
          message: "Code execution failed.",
        }) satisfies ExecuteCodeError,
      SandboxRunError: () =>
        ({
          type: "error",
          message: "Code execution failed.",
        }) satisfies ExecuteCodeError,
    });
  },
});
