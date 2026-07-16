import type {
  Err,
  InferErr,
  InferOk,
  Result as ResultType,
  TaggedErrorInstance,
} from "better-result";

declare const KitBrand: unique symbol;

export type KitModule<TName extends string = string, TValue = unknown> = readonly [
  name: TName,
  value: TValue,
] & {
  readonly [KitBrand]: unknown;
};

export type Kits<TKits extends readonly KitModule[]> = KitsRecord<TKits[number]>;

type KitsRecord<TKit extends KitModule> = {
  [TName in TKit[0]]: Extract<TKit, KitModule<TName>>[1];
};

type HasKitName<TKits extends readonly KitModule[], TName extends string> = TKits extends readonly [
  infer TFirst extends KitModule,
  ...infer TRest extends readonly KitModule[],
]
  ? TFirst[0] extends TName
    ? true
    : HasKitName<TRest, TName>
  : false;

type HasDuplicateKitNames<TKits extends readonly KitModule[]> = TKits extends readonly [
  infer TFirst extends KitModule,
  ...infer TRest extends readonly KitModule[],
]
  ? HasKitName<TRest, TFirst[0]> extends true
    ? true
    : HasDuplicateKitNames<TRest>
  : false;

type DuplicateKitNameError = {
  readonly duplicateKitNameError: "Kit names must be unique";
};

export type UniqueKitNames<TKits extends readonly KitModule[]> =
  HasDuplicateKitNames<TKits> extends true ? DuplicateKitNameError : unknown;

export type AnyKits = Kits<readonly KitModule[]>;

export type InferYieldErr<Y> = Y extends Err<never, infer E> ? E : never;

export type KitGenerator<
  TResult extends ResultType<unknown, unknown>,
  TYield extends Err<never, unknown>,
> = AsyncGenerator<TYield, TResult, unknown>;

export type KitAction<
  TKit,
  TInput,
  TResult extends ResultType<unknown, unknown>,
  TYield extends Err<never, unknown>,
> = (
  context: TKit,
  input: TInput,
) => Promise<ResultType<InferOk<TResult>, InferYieldErr<TYield> | InferErr<TResult>>>;

export type KitGeneratorAction<
  TKit extends AnyKits,
  TInput,
  TYield extends Err<never, unknown>,
  TResult extends ResultType<unknown, unknown>,
> = (context: TKit, input: TInput) => KitGenerator<TResult, TYield>;

export type KitAsyncAction<
  TKit extends AnyKits,
  TInput,
  TResult extends ResultType<unknown, unknown>,
> = (context: TKit, input: TInput) => Promise<TResult>;

export type UnmappedError<TError> = Exclude<TError, { _tag: "ServerFnError" }>;

export type MatchErrorHandlers<
  TError extends TaggedErrorInstance<string, unknown>,
  TMappedError,
> = {
  [K in UnmappedError<TError>["_tag"]]: (
    error: Extract<UnmappedError<TError>, { _tag: K }>,
  ) => TMappedError;
};
