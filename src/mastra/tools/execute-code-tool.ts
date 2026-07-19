import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { SandboxExecuteError, runTypeScriptInSandbox } from "@/lib/sandbox.ts";

const inputSchema = v.object({
  code: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      "JavaScript source to run in an isolated sandbox. Use `export default` to return a JSON-serializable value to the tool result.",
    ),
  ),
});

const successOutputSchema = v.object({
  type: v.literal("success"),
  result: v.optional(v.unknown()),
  logs: v.string(),
});

const errorOutputSchema = v.object({
  type: v.literal("error"),
  message: v.string(),
  name: v.optional(v.string()),
  stack: v.optional(v.string()),
  isSyntaxError: v.optional(v.boolean()),
});

const outputSchema = v.variant("type", [successOutputSchema, errorOutputSchema]);

type ExecuteCodeSuccess = v.InferOutput<typeof successOutputSchema>;
type ExecuteCodeError = v.InferOutput<typeof errorOutputSchema>;

export const executeCodeTool = createTool({
  id: "execute-code",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: [
    "Executes JavaScript in an isolated QuickJS sandbox with no filesystem access.",
    "Use for calculations, data transforms, parsing, formatting, quick algorithmic checks, or reading HTTPS APIs with fetch.",
    "Do not use for authenticated APIs, HTML pages, file access, or long-running jobs; use webFetch to read pages, webSearch to discover sources, or topic file tools for uploaded files.",
    "Network access is limited to HTTPS GET/HEAD requests with Accept or Accept-Language headers; Authorization and cookies are unavailable.",
    "On success, returns output captured from console.log and the JSON-serialized default export when present.",
    "On failure, returns execution error details.",
  ].join(" "),
  execute: async ({ code }) => {
    const executionResult = await runTypeScriptInSandbox(code);

    if (Result.isOk(executionResult)) {
      return {
        type: "success",
        result: executionResult.value.output,
        logs: executionResult.value.logs,
      } satisfies ExecuteCodeSuccess;
    }

    const error = executionResult.error;

    if (SandboxExecuteError.is(error)) {
      return {
        type: "error",
        name: error.name,
        message: error.message,
        stack: error.stack,
        isSyntaxError: error.isSyntaxError,
      } satisfies ExecuteCodeError;
    }

    return {
      type: "error",
      message: "Code execution failed.",
    } satisfies ExecuteCodeError;
  },
});
