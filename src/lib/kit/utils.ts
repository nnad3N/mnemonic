import type {
  Err,
  InferErr,
  InferOk,
  Result as ResultType,
} from "better-result";

declare const KitBrand: unique symbol;

export type KitModule = Record<string, unknown> & {
  readonly [KitBrand]?: unknown;
};

declare const MergedKitBrand: unique symbol;

export type MergedKit<TKits extends readonly KitModule[]> =
  MergedKitValue<TKits> & {
    readonly [MergedKitBrand]?: TKits;
  };

type UnionToIntersection<TUnion> = (
  TUnion extends unknown ? (value: TUnion) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never;

export type MergedKitValue<TKits extends readonly KitModule[]> =
  UnionToIntersection<TKits[number]> & KitModule;

export type BrandedMergedKit = MergedKit<readonly KitModule[]>;

export type InferYieldErr<Y> = Y extends Err<never, infer E> ? E : never;

export type AnyResult = ResultType<unknown, unknown>;

export type KitGenerator<
  TResult extends AnyResult,
  TYield extends Err<never, unknown>,
> = AsyncGenerator<TYield, TResult, unknown>;

export type KitAction<
  TMergedKit,
  TInput,
  TResult extends AnyResult,
  TYield extends Err<never, unknown>,
> = (
  context: TMergedKit,
  input: TInput
) => Promise<
  ResultType<InferOk<TResult>, InferYieldErr<TYield> | InferErr<TResult>>
>;

export type KitGeneratorBody<
  TMergedKit extends BrandedMergedKit,
  TInput,
  TYield extends Err<never, unknown>,
  TResult extends AnyResult,
> = (context: TMergedKit, input: TInput) => KitGenerator<TResult, TYield>;

export type KitAsyncBody<
  TMergedKit extends BrandedMergedKit,
  TInput,
  TResult extends AnyResult,
> = (context: TMergedKit, input: TInput) => Promise<TResult>;
