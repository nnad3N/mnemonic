import { matchError, Result, TaggedError } from "better-result";
import type {
  Err,
  Result as ResultType,
  TaggedErrorInstance,
} from "better-result";

import type {
  BrandedKits,
  KitModule,
  KitAction,
  KitAsyncBody,
  KitGeneratorBody,
  MatchErrorHandlers,
  Kits,
  UniqueKitNames,
} from "./utils";

export type { Kits } from "./utils";

export class ServerFnError extends TaggedError("ServerFnError")<{
  message: string;
  status: "unauthorized" | "server-error";
}>() {}

export const defineKit = <const TName extends string, TValue>(
  name: TName,
  value: TValue
): KitModule<TName, TValue> => [name, value];

export const mergeKits = <TKits extends readonly KitModule[]>(
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
    TKits extends BrandedKits,
    TInput,
    TYield extends Err<never, unknown>,
    TResult extends ResultType<unknown, unknown>,
  >(
    body: KitGeneratorBody<TKits, TInput, TYield, TResult>
  ): KitAction<TKits, TInput, TResult, TYield> =>
  async (context: TKits, input: TInput) =>
    Result.gen(() => body(context, input));

function kitServerFn<
  TKits extends BrandedKits,
  TInput,
  TValue,
  TKitError extends TaggedErrorInstance<string, unknown>,
>(
  action: KitAsyncBody<TKits, TInput, ResultType<TValue, TKitError>>,
  handlers: MatchErrorHandlers<TKitError, ServerFnError>
): (context: TKits, input: TInput) => Promise<TValue>;

function kitServerFn<TKits extends BrandedKits, TInput, TValue>(
  action: KitAsyncBody<TKits, TInput, ResultType<TValue, ServerFnError>>
): (context: TKits, input: TInput) => Promise<TValue>;

function kitServerFn<
  TKits extends BrandedKits,
  TInput,
  TValue,
  TError extends TaggedErrorInstance<string, unknown>,
>(
  action: KitAsyncBody<TKits, TInput, ResultType<TValue, TError>>,
  handlers?: MatchErrorHandlers<TError, ServerFnError>
) {
  return async (context: TKits, input: TInput): Promise<TValue> => {
    const result = await action(context, input);
    const mapped = handlers
      ? result.mapError((error) => matchError(error, handlers))
      : result;

    return mapped.unwrap();
  };
}

export const Kit = {
  gen: kitGen,
  serverFn: kitServerFn,
};
