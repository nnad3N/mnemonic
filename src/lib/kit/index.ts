import { Result, TaggedError } from "better-result";
import type { Err, Result as ResultType } from "better-result";

import type {
  AnyKits,
  KitModule,
  KitAction,
  KitGeneratorAction,
  Kits,
  UniqueKitNames,
} from "./utils";

export type { Kits } from "./utils";

export class ServerFnError extends TaggedError("ServerFnError")<{
  message: string;
  status: "not-found" | "unauthorized" | "server-error" | "bad-request";
  cause?: unknown;
}>() {}

export const toServerFnError = {
  notFound: (message = "Not found") =>
    new ServerFnError({
      message,
      status: "not-found",
    }),
  unauthorized: (message = "Unauthorized") =>
    new ServerFnError({
      message,
      status: "unauthorized",
    }),
  serverError: (message = "Something went wrong") =>
    new ServerFnError({
      message,
      status: "server-error",
    }),
  badRequest: (message = "Bad request") =>
    new ServerFnError({
      message,
      status: "bad-request",
    }),
};

const defineKit = <const TName extends string, TValue>(
  name: TName,
  value: TValue,
): KitModule<TName, TValue> => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return [name, value] as unknown as KitModule<TName, TValue>;
};

const createKitContext = <TKits extends readonly KitModule[]>(
  ...kits: TKits & UniqueKitNames<TKits>
): Kits<TKits> => {
  const context: Record<string, unknown> = {};

  for (const [name, value] of kits) {
    context[name] = value;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return context as Kits<TKits>;
};

const getKit = <TName extends string, TValue>(kit: KitModule<TName, TValue>): TValue => kit[1];

const kitGen =
  <
    TKits extends AnyKits,
    TInput,
    TYield extends Err<never, unknown>,
    TResult extends ResultType<unknown, unknown>,
  >(
    action: KitGeneratorAction<TKits, TInput, TYield, TResult>,
  ): KitAction<TKits, TInput, TResult, TYield> =>
  async (context: TKits, input: TInput) =>
    Result.gen(() => action(context, input));

type KitRunResult<TValue, TError extends Error> = {
  inspect: (effect: (value: TValue) => void) => KitRunResult<TValue, TError>;
  inspectErr: (effect: (error: TError) => void) => KitRunResult<TValue, TError>;
  throws: {
    (): Promise<TValue>;
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- callers may explicitly constrain the boundary error type.
    <TMappedError extends Error>(mapError: (error: TError) => TMappedError): Promise<TValue>;
  };
};

const createKitRunResult = <TValue, TError extends Error>(
  resultPromise: Promise<ResultType<TValue, TError>>,
): KitRunResult<TValue, TError> => {
  function throws(): Promise<TValue>;
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- mirrors the public overload's explicit boundary error constraint.
  function throws<TMappedError extends Error>(
    mapError: (error: TError) => TMappedError,
  ): Promise<TValue>;
  async function throws<TMappedError extends Error>(
    mapError?: (error: TError) => TMappedError,
  ): Promise<TValue> {
    const result = await resultPromise;

    if (Result.isOk(result)) {
      return result.value;
    }

    if (!ServerFnError.is(result.error)) {
      console.error(result.error);
    }

    if (!mapError) {
      throw result.error;
    }

    throw result.mapError(mapError).error;
  }

  return {
    inspect: (effect) => createKitRunResult(resultPromise.then((result) => result.tap(effect))),
    inspectErr: (effect) =>
      createKitRunResult(resultPromise.then((result) => result.tapError(effect))),
    throws,
  };
};

const kitRun = <TValue, TError extends Error>(
  operation: () => Promise<ResultType<TValue, TError>>,
): KitRunResult<TValue, TError> => createKitRunResult(Promise.resolve().then(operation));

type InferPromiseResultValue<TPromise> =
  Awaited<TPromise> extends ResultType<infer TValue, unknown> ? TValue : never;

type InferPromiseResultError<TPromise> =
  Awaited<TPromise> extends ResultType<unknown, infer TError> ? TError : never;

type PromiseAllValues<TPromises extends readonly Promise<ResultType<unknown, Error>>[]> = {
  -readonly [TIndex in keyof TPromises]: InferPromiseResultValue<TPromises[TIndex]>;
};

const kitPromiseAll = async <
  const TPromises extends readonly Promise<ResultType<unknown, Error>>[],
>(
  promises: TPromises,
): Promise<ResultType<PromiseAllValues<TPromises>, InferPromiseResultError<TPromises[number]>>> => {
  const results = await Promise.all(promises);
  const combined = Result.gen(function* () {
    const values: unknown[] = [];

    for (const result of results) {
      values.push(yield* result);
    }

    return Result.ok(values);
  });

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Promise.all and the loop preserve input order; each yielded value occupies its corresponding tuple index.
  return combined as ResultType<
    PromiseAllValues<TPromises>,
    InferPromiseResultError<TPromises[number]>
  >;
};

export const Kit = {
  define: defineKit,
  get: getKit,
  createContext: createKitContext,
  gen: kitGen,
  promiseAll: kitPromiseAll,
  run: kitRun,
};
