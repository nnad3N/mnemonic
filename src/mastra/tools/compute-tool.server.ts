import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { docs } from "@/lib/docs/docs-index";
import { docsLibraries } from "@/lib/docs/docs-types";
import { ToolError } from "@/lib/errors/tool-error";
import { ImageMimeType } from "@/lib/file-validation";
import type { FetchedFile } from "@/lib/get-file.server";
import { toFileText } from "@/lib/get-file.server";
import { mentionKeyShape } from "@/lib/mention-key";
import { runCode } from "@/lib/sandbox/run-code.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { loadMentionedFile } from "@/mastra/tools/file-tool-helpers.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";

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
    "JavaScript module source. Must end with `export default <value>` with a JSON-serializable value. Logic only. Read data from `env`, never write it into the source.",
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
        `Mention key of the file, in the shape ${mentionKeyShape(["file", "attachment"])}. Loaded as \`env.file\` with ${sandboxFileShape}; \`contents\` is the extracted text, PDFs included; empty for images.`,
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

type ComputeSuccess = v.InferOutput<typeof successOutputSchema>;
type ComputeError = v.InferOutput<typeof errorOutputSchema>;

export type SandboxFile = {
  contents: string;
  filename: string;
  size: number;
  mimeType: string;
};

const toSandboxFile = async (file: FetchedFile) => {
  const text = ImageMimeType.is(file.mimeType) ? Result.ok("") : await toFileText(file);

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

export const computeTool = createTool({
  id: "compute",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Computes with JavaScript in a sandbox: arithmetic, statistics, unit conversions and parsing of text, CSV or JSON.",
    "Export the result with `export default`; console output is in `logs`.",
    'Always use mode "file" to work over a file, PDFs included: `env.file.contents` is its text and exists only in that mode. Never inline file contents into `code` or `args`.',
    `Available libraries: ${docsLibraries
      .map((library) => `\`${docs[library].library.importHint}\``)
      .join(" and ")}.`,
  ].join(" "),
  execute: async (input, context) => {
    let file: SandboxFile | undefined;

    if (input.mode === "file") {
      const loaded = await loadMentionedFile({
        fileKey: input.fileKey,
        requestContext: context.requestContext,
      });

      if (Result.isError(loaded)) {
        return { type: "error", message: loaded.error.message } satisfies ComputeError;
      }

      const sandboxFile = await toSandboxFile(loaded.value);

      if (Result.isError(sandboxFile)) {
        return { type: "error", message: sandboxFile.error.message } satisfies ComputeError;
      }

      file = sandboxFile.value;
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
      } satisfies ComputeSuccess;
    }

    return matchError(executionResult.error, {
      SandboxExecuteError: (error): ComputeError => ({
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
