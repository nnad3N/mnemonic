/** Ensures `array` contains exactly every member of `union` — no more, no less. */
export type ExhaustiveArray<TUnion extends string, TArray extends readonly TUnion[]> =
  Exclude<TUnion, TArray[number]> extends never
    ? Exclude<TArray[number], TUnion> extends never
      ? TArray
      : never
    : never;

/**
 * Identity helper that infers a literal tuple, then requires it to be exhaustive
 * for `TUnion`. Curried so `TUnion` is fixed while `TArray` is inferred.
 */
export const exhaustiveArray =
  <TUnion extends string>() =>
  <const TArray extends readonly TUnion[]>(array: ExhaustiveArray<TUnion, TArray>): TArray =>
    array;
