import { matchError, Result, TaggedError } from "better-result";
import type { Err, Result as ResultType, TaggedErrorInstance } from "better-result";

import type {
  AnyKits,
  KitModule,
  KitAction,
  KitAsyncAction,
  KitGeneratorAction,
  MatchErrorHandlers,
  Kits,
  UniqueKitNames,
  UnmappedError,
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

const kitToException =
  <TKits extends AnyKits, TInput, TValue, TError extends Error>(
    action: KitAsyncAction<TKits, TInput, ResultType<TValue, TError>>,
  ) =>
  async (context: TKits, input: TInput): Promise<TValue> => {
    const result = await action(context, input);

    if (Result.isError(result)) {
      throw result.error;
    }

    return result.value;
  };

function kitServerFn<
  TKits extends AnyKits,
  TInput,
  TValue,
  TKitError extends TaggedErrorInstance<string, unknown>,
>(
  action: KitAsyncAction<TKits, TInput, ResultType<TValue, TKitError>>,
  handlers: MatchErrorHandlers<TKitError, ServerFnError>,
): (context: TKits, input: TInput) => Promise<TValue>;

function kitServerFn<TKits extends AnyKits, TInput, TValue>(
  action: KitAsyncAction<TKits, TInput, ResultType<TValue, ServerFnError>>,
): (context: TKits, input: TInput) => Promise<TValue>;

function kitServerFn<
  TKits extends AnyKits,
  TInput,
  TValue,
  TError extends TaggedErrorInstance<string, unknown>,
>(
  action: KitAsyncAction<TKits, TInput, ResultType<TValue, TError>>,
  handlers?: MatchErrorHandlers<TError, ServerFnError>,
) {
  return async (context: TKits, input: TInput): Promise<TValue> => {
    const result = await action(context, input);

    if (handlers) {
      const mapped = result.mapError((error) => {
        if (error instanceof ServerFnError) {
          return error;
        }

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ServerFnError is handled above, leaving the errors represented by handlers.
        const unmappedError = error as UnmappedError<TError>;

        return matchError(unmappedError, handlers);
      });

      if (Result.isError(mapped)) {
        throw mapped.error;
      }

      return mapped.value;
    }

    if (Result.isError(result)) {
      throw result.error;
    }

    return result.value;
  };
}

export const Kit = {
  define: defineKit,
  get: getKit,
  createContext: createKitContext,
  gen: kitGen,
  serverFn: kitServerFn,
  toException: kitToException,
};
