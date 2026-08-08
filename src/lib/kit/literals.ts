/** Ensures `TArray` contains exactly every member of `TUnion` — no more, no less. */
type ExhaustiveArray<TUnion, TArray extends readonly TUnion[]> =
  Exclude<TUnion, TArray[number]> extends never
    ? Exclude<TArray[number], TUnion> extends never
      ? TArray
      : never
    : never;

/**
 * True for template-literal patterns like `` `${string}/${string}` ``. Walks the
 * type one character at a time: a concrete literal bottoms out at `""`, a
 * pattern hits a `${string}` placeholder first.
 */
type IsPattern<T> = T extends string
  ? T extends `${infer THead}${infer TRest}`
    ? string extends THead
      ? true
      : IsPattern<TRest>
    : false
  : false;

/**
 * True when `T` has no enumerable members — a wide primitive such as `string`
 * or `symbol`, or a template-literal pattern.
 */
type IsWide<T> =
  | (string extends T ? true : never)
  | (number extends T ? true : never)
  | (bigint extends T ? true : never)
  | (symbol extends T ? true : never)
  | (object extends T ? true : never)
  | IsPattern<T>;

/** True when `T` is a finite union of literals, so an array can be required to cover it. */
type IsFiniteUnion<T> = true extends IsWide<T> ? false : true;

/**
 * The values a `from<TBase>()` call accepts: every member of `TBase` when it is
 * a finite union, any subset of it when it is wide.
 */
type Entries<TBase, TValues extends readonly TBase[]> =
  IsFiniteUnion<TBase> extends true ? ExhaustiveArray<TBase, TValues> : TValues;

/**
 * A closed set of literal values with a narrowing membership guard, so the
 * values and the union they produce stay a single source of truth.
 */
type Literals<TValues extends readonly unknown[]> = {
  readonly values: TValues;
  is: (value: unknown) => value is TValues[number];
};

const create = <const TValues extends readonly unknown[]>(values: TValues): Literals<TValues> => ({
  values,
  is: (value: unknown): value is TValues[number] =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- widening the tuple is what lets `includes` accept an unchecked value.
    (values as readonly unknown[]).includes(value),
});

/**
 * Declares the set, inferring the tuple from the values themselves.
 *
 * The optional `TBase` constrains every entry, and how strictly depends on what
 * it is. A wide type only rejects malformed entries — `from<MimeType>()` makes
 * `"applicationpdf"` a type error but accepts any subset. A finite union
 * additionally has to be covered exactly, so `from<MnemonicToolName>()` fails
 * if the union grows a member the array is missing.
 *
 * Curried because TypeScript can't infer the tuple while `TBase` is given
 * explicitly.
 */
export const from =
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- TBase is the explicit constraint callers come here for; inlining it would drop the check.
  <TBase = unknown>() =>
    <const TValues extends readonly TBase[]>(values: Entries<TBase, TValues>) =>
      create<TValues>(values);

/** The literal union behind a `Kit.literals` set. */
export type LiteralMember<TLiterals extends Literals<readonly unknown[]>> =
  TLiterals["values"][number];
