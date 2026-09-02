import { extractBytes } from "@kreuzberg/node";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { docs } from "@/lib/docs/docs-index";
import { docsLibraries } from "@/lib/docs/docs-types";
import { ToolError } from "@/lib/errors/tool-error";
import { ImageMimeType } from "@/lib/file-validation";
import type { FetchedFile } from "@/lib/get-file.server";
import { GetFileError, toFileText } from "@/lib/get-file.server";
import { mentionKeyFormat } from "@/lib/mention-key";
import { runCode } from "@/lib/sandbox/run-code.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { extractSchema, loadMentionedFile } from "@/mastra/tools/file-tool-helpers.server";

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

/**
 * Not `jsonValueSchema`: a union emits `anyOf`, and some models answer those with the value JSON-encoded
 * into a string (`"args": "[10, 20, 30]"`) instead of as a value. Output schemas never reach the
 * model, so `result` can stay a union.
 */
const argsSchema = v.optional(
  v.pipe(
    v.record(v.string(), v.unknown()),
    v.description("Data the code reads as `env.args`, keyed by name."),
  ),
);

const sandboxFileFields = Object.keys({
  contents: true,
  filename: true,
  size: true,
  mimeType: true,
} satisfies Record<Exclude<keyof SandboxFile, "pages">, true>)
  .map((field) => `\`${field}\``)
  .join(", ");

const sandboxPageFields = Object.keys({
  page: true,
  text: true,
} satisfies Record<keyof SandboxPage, true>)
  .map((field) => `\`${field}\``)
  .join(", ");

const inputSchema = v.object({
  code: codeSchema,
  args: argsSchema,
  file: v.optional(
    v.pipe(
      v.object({
        key: v.pipe(
          v.string(),
          v.nonEmpty(),
          v.description(
            `Mention key of the file, in the shape ${mentionKeyFormat(["file", "attachment"])}.`,
          ),
        ),
        extract: extractSchema,
        pages: v.optional(
          v.pipe(
            v.boolean(),
            v.description(
              `Also loads \`env.file.pages\`, one entry per page with ${sandboxPageFields}. \`page\` is the position in the file, 1-based, not the number printed on the page. Paginated formats only, such as PDF.`,
            ),
          ),
        ),
      }),
      v.description(
        `The file to work over, loaded as \`env.file\` with ${sandboxFileFields}; \`contents\` is empty for images. Omit when the code needs no file.`,
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

type ComputeSuccess = v.InferOutput<typeof successOutputSchema>;
type ComputeError = v.InferOutput<typeof errorOutputSchema>;

type SandboxPage = {
  page: number;
  text: string;
};

export type SandboxFile = {
  contents: string;
  filename: string;
  size: number;
  mimeType: string;
  pages?: SandboxPage[];
};

const toSandboxFile = async (
  file: FetchedFile,
  options: { extract?: boolean; pages?: boolean },
): Promise<Result<SandboxFile, GetFileError>> => {
  const base = { filename: file.displayName, size: file.sizeBytes, mimeType: file.mimeType };

  if (ImageMimeType.is(file.mimeType)) {
    return Result.ok({ ...base, contents: "" });
  }

  if (!options.pages) {
    const text = await toFileText(file, { extract: options.extract });

    return Result.map(text, (contents) => ({ ...base, contents }));
  }

  const extraction = await Result.tryPromise({
    try: async () =>
      extractBytes(Buffer.from(file.bytes), file.mimeType, { pages: { extractPages: true } }),
    catch: () => new GetFileError({ message: "File could not be loaded." }),
  });

  return Result.map(extraction, (result) => ({
    ...base,
    contents: result.content,
    pages: (result.pages ?? []).map((page) => ({ page: page.pageNumber, text: page.content })),
  }));
};

export const computeTool = createTool({
  id: "compute",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Computes with JavaScript in a sandbox: arithmetic, statistics, unit conversions, parsing of text, CSV or JSON, and BM25 search over a file with an in-memory minisearch index (prefix and fuzzy matching).",
    "Export the result with `export default`; console output is in `logs`.",
    "Always pass `file` to work over a file, never inline file contents into `code` or `args`. `env.file.contents` is the source for text formats, converted text otherwise.",
    `Available libraries: ${docsLibraries
      .map((library) => `\`${docs[library].library.importHint}\``)
      .join(" and ")}.`,
  ].join(" "),
  execute: async (input, context) => {
    let file: SandboxFile | undefined;

    if (input.file) {
      const loaded = await loadMentionedFile({
        fileKey: input.file.key,
        requestContext: context.requestContext,
      });

      if (Result.isError(loaded)) {
        return { type: "error", message: loaded.error.message } satisfies ComputeError;
      }

      const sandboxFile = await toSandboxFile(loaded.value, input.file);

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
