import { Result, TaggedError } from "better-result";
import type { Err, Result as ResultType } from "better-result";

import type {
  AnyResult,
  BrandedMergedKit,
  KitModule,
  KitAction,
  KitAsyncBody,
  KitGeneratorBody,
  MergedKit,
  MergedKitValue,
} from "./utils";

export type { MergedKit } from "./utils";

export class ServerFnError extends TaggedError("ServerFnError")<{
  message: string;
  status: "unauthorized" | "server-error";
}>() {}

export const defineKit = <TValue extends Record<string, unknown>>(
  kit: TValue
): KitModule & TValue => kit;

export const mergeKits = <TKits extends readonly KitModule[]>(
  ...kits: TKits
): MergedKit<TKits> => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const merged = {} as MergedKitValue<TKits>;

  for (const kit of kits) {
    Object.assign(merged, kit);
  }

  return merged;
};

export const Kit = {
  gen:
    <
      TMergedKit extends BrandedMergedKit,
      TInput,
      TYield extends Err<never, unknown>,
      TResult extends AnyResult,
    >(
      body: KitGeneratorBody<TMergedKit, TInput, TYield, TResult>
    ): KitAction<TMergedKit, TInput, TResult, TYield> =>
    async (context: TMergedKit, input: TInput) =>
      Result.gen(() => body(context, input)),

  serverFn:
    <
      TMergedKit extends BrandedMergedKit,
      TInput,
      TValue,
      TError extends ServerFnError,
    >(
      action: KitAsyncBody<TMergedKit, TInput, ResultType<TValue, TError>>
    ) =>
    async (context: TMergedKit, input: TInput): Promise<TValue> => {
      const result = await action(context, input).then((r) => r.unwrap());

      return result;
    },
};
