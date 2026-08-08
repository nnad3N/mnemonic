import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, panic, Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit";
import { docs } from "@/lib/docs/docs-index";
import { docsLibraries } from "@/lib/docs/docs-types";
import { ToolError } from "@/lib/errors/tool-error";
import { LlmNativeMimeType } from "@/lib/file-validation";
import { getAttachment } from "@/lib/get-attachment";
import type { FetchedFile } from "@/lib/get-file";
import { getFile, GetFileError, toFileText } from "@/lib/get-file";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import { mentionKeyShape, parseMentionKey } from "@/lib/mention-key";
import { s3Kit } from "@/lib/s3-kit";
import { runCode } from "@/lib/sandbox/run-code.ts";
import type { MnemonicRequestContext } from "@/mastra/request-context";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema";

const getFileCtx = Kit.createContext(dbKit, s3Kit);

const jsonValueSchema = v.union([
  v.string(),
  v.number(),
  v.boolean(),
  v.record(v.string(), v.unknown()),
  v.array(v.unknown()),
  v.null(),
]);

const codeSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.description(
    "JavaScript module source. Must end with `export default <value>` with a JSON-serializable value. Logic only — read data from `env`, never write it into the source.",
  ),
);

const argsSchema = v.optional(
  v.pipe(jsonValueSchema, v.description("Available to the code as `env.args`.")),
);

const sandboxFileShape = Object.keys({
  contents: true,
  filename: true,
  size: true,
  mimeType: true,
} satisfies Record<keyof SandboxFile, true>)
  .map((field) => `\`${field}\``)
  .join(", ");

const inputSchema = v.variant("mode", [
  v.object({
    mode: v.pipe(v.literal("code"), v.description("Run code that needs no file.")),
    code: codeSchema,
    args: argsSchema,
  }),
  v.object({
    mode: v.pipe(
      v.literal("file"),
      v.description("Run code over a referenced file, loaded for the sandbox as `env.file`."),
    ),
    code: codeSchema,
    args: argsSchema,
    fileKey: v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description(
        `Mention key of the file, in the shape ${mentionKeyShape(["file", "attachment"])}. Loaded as \`env.file\` with ${sandboxFileShape}; \`contents\` is a data URL for PDFs and images, text otherwise.`,
      ),
    ),
  }),
]);

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

const toSandboxFile = async (file: FetchedFile) => {
  if (LlmNativeMimeType.is(file.mimeType)) {
    return Result.ok({
      contents: `data:${file.mimeType};base64,${Buffer.from(file.bytes).toString("base64")}`,
      filename: file.displayName,
      size: file.sizeBytes,
      mimeType: file.mimeType,
    });
  }

  const text = await toFileText(file);

  if (Result.isError(text)) {
    return Result.err(text.error);
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

const loadSandboxFile = async ({ fileKey, flushMessages, requestContext }: LoadSandboxFileInput) =>
  Result.gen(async function* () {
    const mention = parseMentionKey(fileKey);

    if (mention.type === "file") {
      const topicId = requestContext?.get("filter")?.topicId;

      if (!topicId) {
        panic("Missing topicId in request context");
      }

      const file = yield* await getFile(getFileCtx, {
        fileId: mention.value,
        topicId,
      });

      return await toSandboxFile(file);
    }

    if (mention.type === "attachment") {
      const threadId = requestContext?.get("threadId");

      if (!threadId) {
        panic("Missing threadId in request context");
      }

      const file = yield* await getAttachment(Kit.createContext(memoryKit), {
        flushMessages,
        sha256: mention.value,
        threadId,
      });

      return await toSandboxFile(file);
    }

    return Result.err(
      new GetFileError({ message: `"${fileKey}" is not a usable file reference.` }),
    );
  });

export const executeCodeTool = createTool({
  id: "execute-code",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Runs a JavaScript module in a sandbox. No network, no filesystem, and nothing survives between calls.",
    'Always use mode "file" for operations over a file — `env.file` exists only in that mode.',
    `Available libraries: ${docsLibraries
      .map((library) => `\`${docs[library].library.importHint}\``)
      .join(" and ")}.`,
  ].join(" "),
  execute: async (input, context) => {
    let file: SandboxFile | undefined;

    if (input.mode === "file") {
      const result = await loadSandboxFile({
        fileKey: input.fileKey,
        flushMessages: context.agent?.flushMessages,
        requestContext: context.requestContext,
      });

      if (Result.isError(result)) {
        return matchError(result.error, {
          GetAttachmentError: (error): ExecuteCodeError => ({
            type: "error",
            message: error.message,
          }),
          GetFileError: (error): ExecuteCodeError => ({
            type: "error",
            message: error.message,
          }),
          DatabaseError: (cause) => {
            throw new ToolError({ message: "File could not be loaded.", cause });
          },
          MemoryError: (cause) => {
            throw new ToolError({ message: "File could not be loaded.", cause });
          },
          S3Error: (cause) => {
            throw new ToolError({ message: "File could not be loaded.", cause });
          },
        });
      }

      file = result.value;
    }

    const executionResult = await runCode(input.code, {
      args: input.args,
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
      SandboxExecuteError: (error): ExecuteCodeError => ({
        type: "error",
        name: error.name,
        message: error.message,
        isSyntaxError: error.isSyntaxError,
      }),
      SandboxInitError: (cause) => {
        throw new ToolError({ message: "Code execution failed.", cause });
      },
      SandboxRunError: (cause) => {
        throw new ToolError({ message: "Code execution failed.", cause });
      },
    });
  },
});
