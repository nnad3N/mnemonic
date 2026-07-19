import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import { getDefaultFetchAdapter, loadQuickJs } from "@sebastianwessel/quickjs";
import type { SandboxOptions } from "@sebastianwessel/quickjs";
import type { JSONValue } from "ai";
import { Result, TaggedError } from "better-result";

const EXECUTION_TIMEOUT_MS = 5_000;
const FETCH_TIMEOUT_MS = 5_000;
const MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const MAX_STACK_SIZE_BYTES = 1024 * 1024;

const ALLOWED_FETCH_METHODS = ["GET", "HEAD"];
const ALLOWED_FETCH_HEADERS = ["accept", "accept-language"];

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

const sanitizeFetchHeaders = (headersInit: HeadersInit | undefined): Headers => {
  const headers = new Headers();
  if (!headersInit) return headers;

  new Headers(headersInit).forEach((value, key) => {
    if (ALLOWED_FETCH_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
};

const baseFetchAdapter = getDefaultFetchAdapter({
  allowedProtocols: ["https:"],
  rateLimitDuration: 10,
  rateLimitPoints: 20,
  timeout: FETCH_TIMEOUT_MS,
});

const fetchAdapter = async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = input instanceof Request ? input : undefined;

  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  if (!ALLOWED_FETCH_METHODS.includes(method)) {
    throw new Error("Only GET and HEAD requests are allowed");
  }

  return baseFetchAdapter(input, {
    headers: sanitizeFetchHeaders(init?.headers ?? request?.headers),
    method,
    redirect: "error",
  });
};

const formatConsoleArgs = (args: unknown[]): string =>
  args.map((value) => Deno.inspect(value, { colors: false })).join(" ");

const createExecuteSandboxOptions = (mutStdout: string[]): SandboxOptions => ({
  allowFetch: true,
  allowFs: false,
  console: {
    error: (...args) => {
      mutStdout.push(formatConsoleArgs(args));
    },
    info: (...args) => {
      mutStdout.push(formatConsoleArgs(args));
    },
    log: (...args) => {
      mutStdout.push(formatConsoleArgs(args));
    },
    warn: (...args) => {
      mutStdout.push(formatConsoleArgs(args));
    },
  },
  fetchAdapter,
  executionTimeout: EXECUTION_TIMEOUT_MS,
  maxStackSize: MAX_STACK_SIZE_BYTES,
  memoryLimit: MEMORY_LIMIT_BYTES,
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

type RunTypeScriptInSandboxResult = Result<
  {
    output: JSONValue | undefined;
    logs: string;
  },
  SandboxError
>;

export const runTypeScriptInSandbox = async (
  code: string,
): Promise<RunTypeScriptInSandboxResult> => {
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

  const mutStdout: string[] = [];

  const evalResult = await Result.tryPromise({
    try: async () =>
      sandboxResult.value.runSandboxed(
        async ({ evalCode }) => evalCode(code),
        createExecuteSandboxOptions(mutStdout),
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

  return Result.ok({ output, logs: mutStdout.join("\n") });
};
