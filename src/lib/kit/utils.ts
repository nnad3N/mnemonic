import type {
  Err,
  InferErr,
  InferOk,
  Result as ResultType,
  TaggedErrorInstance,
} from "better-result";

export type KitModule<
  TName extends string = string,
  TValue = unknown,
> = readonly [name: TName, value: TValue];

declare const KitsBrand: unique symbol;

type KitContextBrand = {
  readonly [KitsBrand]?: unknown;
};

export type Kits<TKits extends readonly KitModule[]> = KitsValue<
  TKits[number]
> &
  KitContextBrand;

export type KitsValue<TKit extends KitModule> = {
  [TName in TKit[0]]: Extract<TKit, KitModule<TName>>[1];
};

type HasKitName<
  TKits extends readonly KitModule[],
  TName extends string,
> = TKits extends readonly [
  infer TFirst extends KitModule,
  ...infer TRest extends readonly KitModule[],
]
  ? TFirst[0] extends TName
    ? true
    : HasKitName<TRest, TName>
  : false;

type HasDuplicateKitNames<TKits extends readonly KitModule[]> =
  TKits extends readonly [
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

export type BrandedKits = Kits<readonly KitModule[]>;

export type InferYieldErr<Y> = Y extends Err<never, infer E> ? E : never;

export type KitGenerator<
  TResult extends ResultType<unknown, unknown>,
  TYield extends Err<never, unknown>,
> = AsyncGenerator<TYield, TResult, unknown>;

export type KitAction<
  TMergedKit,
  TInput,
  TResult extends ResultType<unknown, unknown>,
  TYield extends Err<never, unknown>,
> = (
  context: TMergedKit,
  input: TInput
) => Promise<
  ResultType<InferOk<TResult>, InferYieldErr<TYield> | InferErr<TResult>>
>;

export type KitGeneratorBody<
  TMergedKit extends BrandedKits,
  TInput,
  TYield extends Err<never, unknown>,
  TResult extends ResultType<unknown, unknown>,
> = (context: TMergedKit, input: TInput) => KitGenerator<TResult, TYield>;

export type KitAsyncBody<
  TMergedKit extends BrandedKits,
  TInput,
  TResult extends ResultType<unknown, unknown>,
> = (context: TMergedKit, input: TInput) => Promise<TResult>;

export type MatchErrorHandlers<
  TError extends TaggedErrorInstance<string, unknown>,
  TMappedError,
> = {
  [K in TError["_tag"]]: (error: Extract<TError, { _tag: K }>) => TMappedError;
};
