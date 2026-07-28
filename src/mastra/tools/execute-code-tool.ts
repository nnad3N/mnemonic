import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import * as v from "valibot";

import { runCode } from "@/lib/sandbox/run-code.ts";

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
      "JavaScript source to run in the sandbox. End with `export default <value>` so the tool returns that JSON-serializable value as `result`. Read tool input data from `env.args` instead of embedding it in the source.",
    ),
  ),
  args: v.optional(
    v.pipe(
      jsonValueSchema,
      v.description(
        "JSON-serializable input data available in the sandbox as `env.args`. Prefer this over embedding large strings or structured data in `code`. Defaults to null when omitted.",
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

export const executeCodeTool = createTool({
  id: "execute-code",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: [
    "Executes code in an isolated ES6 JavaScript sandbox with no filesystem or network access.",
    "Use for calculations (prefer using mathjs over plain code), data transforms, parsing, formatting, or quick algorithmic checks.",
    "Pass input data via `args` (read as `env.args` in code); do not embed large text or structured payloads in the source.",
    "You can use mathjs after importing it. If uncertain about what functions are available, research it on the official mathjs docs.",
    "The tool result is `export default` (JSON-serialized into `result`). Example: `export default { answer: value }`.",
    "On success, `result` is the default export and `logs` is console output.",
    "On failure, returns execution error details.",
  ].join(" "),
  execute: async ({ code, args }) => {
    const executionResult = await runCode(code, args);

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
      SandboxArgsError: (error) =>
        ({
          type: "error",
          message: error.message,
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
