import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import * as v from "valibot";

import { SandboxExecuteError, runCode } from "@/lib/sandbox/run-code.ts";

const inputSchema = v.object({
  code: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      "JavaScript source to run in the sandbox. End with `export default <value>` so the tool returns that JSON-serializable value as `result`.",
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
    "Executes JavaScript in an isolated QuickJS sandbox with no filesystem or network access.",
    "Use for calculations, data transforms, parsing, formatting, or quick algorithmic checks.",
    "You can use mathjs after importing it. If uncertain about what functions are available, research it on the official mathjs docs.",
    "The tool result is `export default` (JSON-serialized into `result`). Example: `export default { answer: value }`.",
    "On success, `result` is the default export and `logs` is console output.",
    "On failure, returns execution error details.",
  ].join(" "),
  execute: async ({ code }) => {
    const executionResult = await runCode(code);

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
