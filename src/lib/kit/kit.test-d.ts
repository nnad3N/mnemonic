import { Result, TaggedError } from "better-result";
import type { Result as ResultType, TaggedErrorInstance } from "better-result";
import { assertType, expectTypeOf, test } from "vitest";

import { Kit, ServerFnError } from ".";
import type { KitModule, Kits } from "./utils";

class TypeTestError extends TaggedError("TypeTestError")<{
  message: string;
}>() {}

type OtherTypeTestError = TaggedErrorInstance<
  "OtherTypeTestError",
  { message: string }
>;

const numberKit = Kit.define("number", {
  double: (value: number) => Result.ok(value * 2),
});

const textKit = Kit.define("text", {
  label: (value: number) => Result.ok(`value:${value}`),
});

type TestKits = Kits<[typeof numberKit, typeof textKit]>;

test("Kit.merge infers a Kits tuple context", () => {
  const kits = Kit.merge(numberKit, textKit);

  expectTypeOf(kits).toEqualTypeOf<TestKits>();
  assertType<ResultType<number, never>>(kits.number.double(2));
  assertType<ResultType<string, never>>(kits.text.label(2));
});

test("Kit.merge rejects duplicate kit names", () => {
  const duplicateNumberKit = Kit.define("number", {
    triple: (value: number) => Result.ok(value * 3),
  });

  // @ts-expect-error duplicate kit names are rejected at the merge boundary
  Kit.merge(numberKit, duplicateNumberKit);
});

test("KitModule rejects unbranded tuples", () => {
  const plainKit = [
    "number",
    { double: (value: number) => Result.ok(value) },
  ] as const;

  // @ts-expect-error kit modules must be created with defineKit
  assertType<KitModule>(plainKit);

  // @ts-expect-error mergeKits only accepts branded kit modules
  Kit.merge(plainKit);
});

test("Kit.serverFn infers custom error handler keys", () => {
  const action = async (
    _ctx: TestKits,
    _input: undefined
  ): Promise<ResultType<string, TypeTestError | OtherTypeTestError>> =>
    Result.err(new TypeTestError({ message: "failed" }));

  Kit.serverFn(action, {
    TypeTestError: (error) =>
      new ServerFnError({
        message: error.message,
        status: "server-error",
      }),
    OtherTypeTestError: (error) =>
      new ServerFnError({
        message: error.message,
        status: "server-error",
      }),
  });

  // @ts-expect-error all custom tagged error variants need handlers
  Kit.serverFn(action, {
    TypeTestError: (error) =>
      new ServerFnError({
        message: error.message,
        status: "server-error",
      }),
  });
});

test("Kit.serverFn accepts ServerFnError actions without handlers", () => {
  const action = Kit.gen(async function* (_ctx: TestKits, _input: undefined) {
    yield* new ServerFnError({
      message: "already mapped",
      status: "server-error",
    });

    return Result.ok();
  });

  expectTypeOf(Kit.serverFn(action)).toEqualTypeOf<
    (context: TestKits, input: undefined) => Promise<void>
  >();
});
