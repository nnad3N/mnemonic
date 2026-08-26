import { Result, TaggedError } from "better-result";
import type { Result as ResultType, TaggedErrorInstance } from "better-result";
import { assertType, expectTypeOf, test } from "vitest";

import { ServerFnError } from "@/lib/errors/server-fn-error";

import * as Kit from ".";
import type { KitModule, Kits } from "./utils";

class TypeTestError extends TaggedError("TypeTestError")<{
  message: string;
}> {}

type OtherTypeTestError = TaggedErrorInstance<"OtherTypeTestError", { message: string }>;

const numberKit = Kit.define("number", {
  double: (value: number) => Result.ok(value * 2),
});

const textKit = Kit.define("text", {
  label: (value: number) => Result.ok(`value:${value}`),
});

type TestCtx = Kits<[typeof numberKit, typeof textKit]>;

test("Kit.createContext infers a Kits tuple context", () => {
  const ctx = Kit.createContext(numberKit, textKit);

  expectTypeOf(ctx).toEqualTypeOf<TestCtx>();
  assertType<ResultType<number, never>>(ctx.number.double(2));
  assertType<ResultType<string, never>>(ctx.text.label(2));
});

test("Kit.get infers the kit value", () => {
  const number = Kit.get(numberKit);

  expectTypeOf(number).toEqualTypeOf<(typeof numberKit)[1]>();
  assertType<ResultType<number, never>>(number.double(2));
});

test("Kit.createContext rejects duplicate kit names", () => {
  const duplicateNumberKit = Kit.define("number", {
    triple: (value: number) => Result.ok(value * 3),
  });

  // @ts-expect-error duplicate kit names are rejected at the createContext boundary
  Kit.createContext(numberKit, duplicateNumberKit);
});

test("KitModule rejects unbranded tuples", () => {
  const plainKit = ["number", { double: (value: number) => Result.ok(value) }] as const;

  // @ts-expect-error kit modules must be created with defineKit
  assertType<KitModule>(plainKit);

  // @ts-expect-error createKitContext only accepts branded kit modules
  Kit.createContext(plainKit);

  // @ts-expect-error getKit only accepts branded kit modules
  Kit.get(plainKit);
});

test("Kit.run infers async Result values and errors", () => {
  const operation = async (): Promise<ResultType<string, TypeTestError | OtherTypeTestError>> =>
    Promise.resolve(Result.err(new TypeTestError({ message: "failed" })));
  const run = Kit.run(operation);

  run.inspect((value) => {
    expectTypeOf(value).toEqualTypeOf<string>();
  });

  run.inspectErr((error) => {
    expectTypeOf(error).toEqualTypeOf<TypeTestError | OtherTypeTestError>();
  });

  expectTypeOf(run.throws()).toEqualTypeOf<Promise<string>>();
  expectTypeOf(
    run.throws<ServerFnError>((error) => {
      expectTypeOf(error).toEqualTypeOf<TypeTestError | OtherTypeTestError>();

      return new ServerFnError({
        message: error.message,
        status: "server-error",
      });
    }),
  ).toEqualTypeOf<Promise<string>>();

  // @ts-expect-error mapped errors must be Error instances
  void run.throws(() => "failed");
});

test("Kit.literals narrows an unknown to the literal union", () => {
  const status = Kit.literals.from()(["pending", "done"]);

  expectTypeOf(status.values).toEqualTypeOf<readonly ["pending", "done"]>();

  // oxlint-disable-next-line anti-slop/no-known-value-widening
  const value: unknown = "done";

  if (status.is(value)) {
    expectTypeOf(value).toEqualTypeOf<"pending" | "done">();
  }
});

test("Kit.literals.from constrains entries to a wide base type", () => {
  const mimeType = Kit.literals.from<`${string}/${string}`>()(["image/png"]);

  expectTypeOf(mimeType.values).toEqualTypeOf<readonly ["image/png"]>();

  // @ts-expect-error entries must match the base type
  Kit.literals.from<`${string}/${string}`>()(["imagepng"]);
});

test("Kit.literals.from requires a finite union to be covered exactly", () => {
  type Level = "standard" | "balanced" | "max";

  const level = Kit.literals.from<Level>()(["standard", "balanced", "max"]);

  expectTypeOf(level.values).toEqualTypeOf<readonly ["standard", "balanced", "max"]>();

  // @ts-expect-error every member of the union must be present
  Kit.literals.from<Level>()(["standard", "balanced"]);

  // @ts-expect-error values outside the union are rejected
  Kit.literals.from<Level>()(["standard", "balanced", "max", "turbo"]);
});

test("Kit.literals.from covers finite unions of any literal type", () => {
  Kit.literals.from<80 | 443>()([80, 443]);

  // @ts-expect-error 443 is missing
  Kit.literals.from<80 | 443>()([80]);

  Kit.literals.from<"a" | 1 | true>()(["a", 1, true]);

  // @ts-expect-error true is missing
  Kit.literals.from<"a" | 1 | true>()(["a", 1]);

  // wide types stay a plain constraint
  Kit.literals.from<number>()([80]);
  Kit.literals.from<symbol>()([Symbol.iterator]);
});

test("Kit.promiseAll preserves tuple values and unions errors", () => {
  const numberResult: Promise<ResultType<number, TypeTestError>> = Promise.resolve(Result.ok(1));
  const textResult: Promise<ResultType<string, OtherTypeTestError>> = Promise.resolve(
    Result.ok("two"),
  );

  expectTypeOf(Kit.promiseAll([numberResult, textResult])).toEqualTypeOf<
    Promise<ResultType<[number, string], TypeTestError | OtherTypeTestError>>
  >();
});
