/* oxlint-disable no-shadow */
import { Panic, panic, Result, TaggedError } from "better-result";
import { describe, expect, it } from "vitest";

import { Kit, ServerFnError } from ".";
import type { Kits } from ".";

class TestKitError extends TaggedError("TestKitError")<{
  message: string;
}>() {}

const numberKit = Kit.define("number", {
  double: (value: number) => Result.ok(value * 2),
  increment: async (value: number) => Result.ok(value + 1),
});

const textKit = Kit.define("text", {
  label: (value: number) => Result.ok(`value:${value}`),
});

const kits = Kit.merge(numberKit, textKit);

type TestKits = Kits<[typeof numberKit, typeof textKit]>;

describe("kit", () => {
  it("merges defined kits into a context keyed by kit name", () => {
    expect(kits.number.double(3).unwrap()).toBe(6);
    expect(kits.text.label(4).unwrap()).toBe("value:4");
  });

  it("composes yielded kit results in Kit.gen", async () => {
    const action = Kit.gen(async function* (
      ctx: TestKits,
      input: { value: number }
    ) {
      const incremented = yield* await ctx.number.increment(input.value);
      const doubled = yield* ctx.number.double(incremented);
      const label = yield* ctx.text.label(doubled);

      return Result.ok(label);
    });

    const result = await action(kits, { value: 2 });

    expect(result.unwrap()).toBe("value:6");
  });

  it("unwraps successful Kit.serverFn results", async () => {
    const action = Kit.gen(async function* (
      ctx: TestKits,
      input: { value: number }
    ) {
      const doubled = yield* ctx.number.double(input.value);

      return Result.ok(doubled);
    });

    await expect(Kit.serverFn(action)(kits, { value: 5 })).resolves.toBe(10);
  });

  it("maps custom tagged errors to ServerFnError", async () => {
    const action = Kit.gen(async function* (_ctx: TestKits, _input: null) {
      yield* new TestKitError({ message: "kit failed" });

      return Result.ok();
    });

    const serverFn = Kit.serverFn(action, {
      TestKitError: (error) =>
        new ServerFnError({
          message: error.message,
          status: "server-error",
        }),
    });

    await expect(serverFn(kits, null)).rejects.toMatchObject({
      _tag: "ServerFnError",
      message: "kit failed",
      status: "server-error",
    });
  });

  it("accepts ServerFnError results without an error map", async () => {
    const action = Kit.gen(async function* (_ctx: TestKits, _input: null) {
      yield* new ServerFnError({
        message: "already mapped",
        status: "unauthorized",
      });

      return Result.ok();
    });

    const serverFn = Kit.serverFn(action);

    await expect(serverFn(kits, null)).rejects.toMatchObject({
      _tag: "ServerFnError",
      message: "already mapped",
      status: "unauthorized",
    });
  });

  it("propagates panics from server function actions", async () => {
    const cause = new Error("panic cause");
    const action = async (_ctx: TestKits, _input: null) => {
      Result.ok(1).map(() => {
        throw cause;
      });

      return Result.ok();
    };
    const serverFn = Kit.serverFn(action);

    const error = await serverFn(kits, null).catch((error: unknown) => error);

    expect(Panic.is(error)).toBeTruthy();
    expect(error).toMatchObject({ cause });
  });

  it("propagates explicit panic calls from server function actions", async () => {
    const cause = new Error("explicit panic cause");
    const message = "explicit panic";
    const action = async (_ctx: TestKits, _input: null) => {
      panic(message, cause);
    };
    const serverFn = Kit.serverFn(action);

    const error = await serverFn(kits, null).catch((error: unknown) => error);

    expect(Panic.is(error)).toBeTruthy();
    expect(error).toMatchObject({
      cause,
      message,
    });
  });
});
