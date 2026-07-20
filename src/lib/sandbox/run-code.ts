import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import { loadQuickJs } from "@sebastianwessel/quickjs";
import type { SandboxOptions } from "@sebastianwessel/quickjs";
import type { JSONValue } from "ai";
import { Result, TaggedError } from "better-result";

import mathjsBundle from "./modules/mathjs.txt?raw";

const EXECUTION_TIMEOUT_MS = 5_000;
const MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const MAX_STACK_SIZE_BYTES = 1024 * 1024;

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

const createExecuteSandboxOptions = (mutLogs: string[]): SandboxOptions => ({
  allowFetch: false,
  allowFs: false,
  console: {
    error: (...args) => {
      mutLogs.push(formatConsoleArgs(args));
    },
    info: (...args) => {
      mutLogs.push(formatConsoleArgs(args));
    },
    log: (...args) => {
      mutLogs.push(formatConsoleArgs(args));
    },
    warn: (...args) => {
      mutLogs.push(formatConsoleArgs(args));
    },
  },
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

const serializeResult = (value: unknown): JSONValue | undefined => {
  if (value === undefined) {
    return value;
  }

  const serialized = Result.try(() => JSON.parse(JSON.stringify(value)));

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

export const runCode = async (code: string): Promise<RunCodeResult> => {
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
        createExecuteSandboxOptions(mutLogs),
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
