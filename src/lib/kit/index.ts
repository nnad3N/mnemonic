import { matchError, Result, TaggedError } from "better-result";
import type {
  Err,
  Result as ResultType,
  TaggedErrorInstance,
} from "better-result";

import type {
  AnyKits,
  KitModule,
  KitAction,
  KitAsyncAction,
  KitGeneratorAction,
  MatchErrorHandlers,
  Kits,
  UniqueKitNames,
} from "./utils";

export type { Kits } from "./utils";

export class ServerFnError extends TaggedError("ServerFnError")<{
  message: string;
  status: "unauthorized" | "server-error";
}>() {}

export const toServerFnError = {
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
};

const defineKit = <const TName extends string, TValue>(
  name: TName,
  value: TValue
): KitModule<TName, TValue> => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return [name, value] as unknown as KitModule<TName, TValue>;
};

const mergeKits = <TKits extends readonly KitModule[]>(
  ...kits: TKits & UniqueKitNames<TKits>
): Kits<TKits> => {
  const merged: Record<string, unknown> = {};

  for (const [name, value] of kits) {
    merged[name] = value;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return merged as Kits<TKits>;
};

const kitGen =
  <
    TKits extends AnyKits,
    TInput,
    TYield extends Err<never, unknown>,
    TResult extends ResultType<unknown, unknown>,
  >(
    action: KitGeneratorAction<TKits, TInput, TYield, TResult>
  ): KitAction<TKits, TInput, TResult, TYield> =>
  async (context: TKits, input: TInput) =>
    Result.gen(() => action(context, input));

function kitServerFn<
  TKits extends AnyKits,
  TInput,
  TValue,
  TKitError extends TaggedErrorInstance<string, unknown>,
>(
  action: KitAsyncAction<TKits, TInput, ResultType<TValue, TKitError>>,
  handlers: MatchErrorHandlers<TKitError, ServerFnError>
): (context: TKits, input: TInput) => Promise<TValue>;

function kitServerFn<TKits extends AnyKits, TInput, TValue>(
  action: KitAsyncAction<TKits, TInput, ResultType<TValue, ServerFnError>>
): (context: TKits, input: TInput) => Promise<TValue>;

function kitServerFn<
  TKits extends AnyKits,
  TInput,
  TValue,
  TError extends TaggedErrorInstance<string, unknown>,
>(
  action: KitAsyncAction<TKits, TInput, ResultType<TValue, TError>>,
  handlers?: MatchErrorHandlers<TError, ServerFnError>
) {
  return async (context: TKits, input: TInput): Promise<TValue> => {
    const result = await action(context, input);

    if (handlers) {
      const mapped = result.mapError((error) => matchError(error, handlers));

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
  merge: mergeKits,
  gen: kitGen,
  serverFn: kitServerFn,
};
