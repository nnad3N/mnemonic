import { Result, TaggedError } from "better-result";
import type { Result as ResultType, TaggedErrorInstance } from "better-result";
import { assertType, expectTypeOf, test } from "vitest";

import { Kit, ServerFnError } from ".";
import type { KitModule, Kits } from "./utils";

class TypeTestError extends TaggedError("TypeTestError")<{
  message: string;
}>() {}

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

test("Kit.serverFn infers custom error handler keys", () => {
  const action = async (
    _ctx: TestCtx,
    _input: undefined,
  ): Promise<ResultType<string, TypeTestError | OtherTypeTestError>> =>
    Promise.resolve(Result.err(new TypeTestError({ message: "failed" })));

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
  const action = Kit.gen(async function* (_ctx: TestCtx, _input: undefined) {
    yield* await Promise.resolve(
      new ServerFnError({
        message: "already mapped",
        status: "server-error",
      }),
    );

    return Result.ok();
  });

  expectTypeOf(Kit.serverFn(action)).toEqualTypeOf<
    (context: TestCtx, input: undefined) => Promise<void>
  >();
});

test("Kit.serverFn skips ServerFnError handler keys for mixed unions", () => {
  const action = async (
    _ctx: TestCtx,
    _input: undefined,
  ): Promise<ResultType<string, TypeTestError | ServerFnError>> =>
    Promise.resolve(
      Result.err(
        new ServerFnError({
          message: "already mapped",
          status: "server-error",
        }),
      ),
    );

  expectTypeOf(
    Kit.serverFn(action, {
      TypeTestError: (error) =>
        new ServerFnError({
          message: error.message,
          status: "server-error",
        }),
    }),
  ).toEqualTypeOf<(context: TestCtx, input: undefined) => Promise<string>>();
});
