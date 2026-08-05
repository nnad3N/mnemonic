import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import { loadQuickJs } from "@sebastianwessel/quickjs";
import type { SandboxOptions } from "@sebastianwessel/quickjs";
import type { JSONValue } from "ai";
import { Result, TaggedError } from "better-result";

import mathjsBundle from "./modules/mathjs.txt?raw";

const EXECUTION_TIMEOUT_MS = 10_000;
const MEMORY_LIMIT_BYTES = 128 * 1024 * 1024;
const MAX_STACK_SIZE_BYTES = 4 * 1024 * 1024;

export class SandboxInitError extends TaggedError("SandboxInitError")<{
  cause: unknown;
  message: string;
}>() {}

export class SandboxRunError extends TaggedError("SandboxRunError")<{
  cause: unknown;
  message: string;
}>() {}

export class SandboxExecuteError extends TaggedError("SandboxExecuteError")<{
  name: string;
  message: string;
  stack?: string;
  isSyntaxError?: boolean;
}>() {}

export type SandboxError = SandboxInitError | SandboxRunError | SandboxExecuteError;

type QuickJsSandbox = Awaited<ReturnType<typeof loadQuickJs>>;

let quickJsPromise: Promise<QuickJsSandbox> | undefined;

const getQuickJsSandbox = async (): Promise<QuickJsSandbox> => {
  quickJsPromise ??= loadQuickJs(variant);
  return quickJsPromise;
};

const formatConsoleArgs = (args: unknown[]): string =>
  args.map((value) => Deno.inspect(value, { colors: false })).join(" ");

const createExecuteSandboxOptions = (
  mutLogs: string[],
  env: SandboxOptions["env"],
): SandboxOptions => ({
  allowFetch: false,
  allowFs: false,
  console: {
    error: (...values) => {
      mutLogs.push(formatConsoleArgs(values));
    },
    info: (...values) => {
      mutLogs.push(formatConsoleArgs(values));
    },
    log: (...values) => {
      mutLogs.push(formatConsoleArgs(values));
    },
    warn: (...values) => {
      mutLogs.push(formatConsoleArgs(values));
    },
  },
  env,
  executionTimeout: EXECUTION_TIMEOUT_MS,
  maxStackSize: MAX_STACK_SIZE_BYTES,
  memoryLimit: MEMORY_LIMIT_BYTES,
  nodeModules: {
    mathjs: {
      "index.js": mathjsBundle,
    },
  },
  transformTypescript: false,
});

const serializeJson = (value: unknown): Result<JSONValue, unknown> =>
  Result.try(() => JSON.parse(JSON.stringify(value)));

const serializeResult = (value: unknown): JSONValue | undefined => {
  if (value === undefined) {
    return value;
  }

  const serialized = serializeJson(value);

  if (Result.isOk(serialized)) {
    return serialized.value;
  }

  return undefined;
};

type RunCodeResult = Result<
  {
    output: JSONValue | undefined;
    logs: string | undefined;
  },
  SandboxError
>;

export const runCode = async (
  code: string,
  env?: SandboxOptions["env"],
): Promise<RunCodeResult> => {
  const sandboxResult = await Result.tryPromise({
    try: async () => getQuickJsSandbox(),
    catch: (cause) =>
      new SandboxInitError({
        message: "Failed to initialize QuickJS sandbox",
        cause,
      }),
  });

  if (Result.isError(sandboxResult)) {
    return Result.err(sandboxResult.error);
  }

  const mutLogs: string[] = [];

  const evalResult = await Result.tryPromise({
    try: async () =>
      sandboxResult.value.runSandboxed(
        async ({ evalCode }) => evalCode(code),
        createExecuteSandboxOptions(mutLogs, env),
      ),
    catch: (cause) =>
      new SandboxRunError({
        cause,
        message: "Failed to run sandboxed code",
      }),
  });

  if (Result.isError(evalResult)) {
    return Result.err(evalResult.error);
  }

  if (!evalResult.value.ok) {
    const error = evalResult.value.error;

    return Result.err(
      new SandboxExecuteError({
        name: error.name,
        message: error.message,
        stack: error.stack,
        isSyntaxError: evalResult.value.isSyntaxError,
      }),
    );
  }

  const output = serializeResult(evalResult.value.data);
  const logs = mutLogs.join("\n").trim();

  return Result.ok({ output, logs: logs.length > 0 ? logs : undefined });
};
