import { Panic, Result, TaggedError } from "better-result";
import { describe, expect, it } from "vitest";

import { Kit, ServerFnError } from ".";
import type { Kits } from ".";

class TestKitError extends TaggedError("TestKitError")<{
  message: string;
}>() {}

const numberKit = Kit.define("number", {
  double: (value: number) => Result.ok(value * 2),
  increment: async (value: number) => Promise.resolve(Result.ok(value + 1)),
});

const textKit = Kit.define("text", {
  label: (value: number) => Result.ok(`value:${value}`),
});

const ctx = Kit.createContext(numberKit, textKit);

type TestCtx = Kits<[typeof numberKit, typeof textKit]>;

describe("kit", () => {
  it("creates a context keyed by kit name", () => {
    expect(ctx.number.double(3).unwrap()).toBe(6);
    expect(ctx.text.label(4).unwrap()).toBe("value:4");
  });

  it("gets the kit value from a kit module", () => {
    const number = Kit.get(numberKit);

    expect(number.double(3).unwrap()).toBe(6);
  });

  it("composes yielded kit results in Kit.gen", async () => {
    const action = Kit.gen(async function* (ctx: TestCtx, input: { value: number }) {
      const incremented = yield* await ctx.number.increment(input.value);
      const doubled = yield* ctx.number.double(incremented);
      const label = yield* ctx.text.label(doubled);

      return Result.ok(label);
    });

    const result = await action(ctx, { value: 2 });

    expect(result.unwrap()).toBe("value:6");
  });

  it("runs an async Result operation once and returns its successful value", async () => {
    let executionCount = 0;
    const run = Kit.run(async () => {
      executionCount += 1;
      return Promise.resolve(Result.ok(10));
    });

    await expect(run.throws()).resolves.toBe(10);
    await expect(run.throws()).resolves.toBe(10);
    expect(executionCount).toBe(1);
  });

  it("inspects successful values through Kit.run", async () => {
    const inspectedValues: number[] = [];

    const run = Kit.run(async () => Promise.resolve(Result.ok(10))).inspect((value) => {
      inspectedValues.push(value);
    });

    await expect(run.throws()).resolves.toBe(10);
    expect(inspectedValues).toEqual([10]);
  });

  it("inspects errors through Kit.run", async () => {
    const error = new TestKitError({ message: "observed failure" });
    const observedErrors: TestKitError[] = [];

    const run = Kit.run(async () => Promise.resolve(Result.err(error)))
      .inspectErr((observedError) => {
        observedErrors.push(observedError);
      })
      .inspectErr((observedError) => {
        observedErrors.push(observedError);
      });

    await expect(run.throws()).rejects.toBe(error);
    expect(observedErrors).toHaveLength(2);
    expect(observedErrors.at(0)).toBe(error);
    expect(observedErrors.at(1)).toBe(error);
  });

  it("maps errors before throwing through Kit.run", async () => {
    const error = new TestKitError({ message: "kit failed" });
    const serverError = new ServerFnError({
      message: "boundary failed",
      status: "server-error",
    });

    await expect(
      Kit.run(async () => Promise.resolve(Result.err(error))).throws<ServerFnError>(
        () => serverError,
      ),
    ).rejects.toBe(serverError);
  });

  it("preserves Panic behavior when a Kit.run error mapper throws", async () => {
    const cause = new Error("mapper panic");
    const error = new TestKitError({ message: "kit failed" });
    const thrown = await Kit.run(async () => Promise.resolve(Result.err(error)))
      .throws(() => {
        throw cause;
      })
      .catch((thrown: unknown) => thrown);

    expect(Panic.is(thrown)).toBeTruthy();
    expect(thrown).toMatchObject({ cause });
  });

  it("combines parallel Result promises in input order", async () => {
    const result = await Kit.promiseAll([
      Promise.resolve(Result.ok(1)),
      Promise.resolve(Result.ok("two")),
    ]);

    expect(result.unwrap()).toEqual([1, "two"]);
  });

  it("returns the first Kit.promiseAll error in input order", async () => {
    const firstError = new TestKitError({ message: "first failure" });
    const secondError = new TestKitError({ message: "second failure" });
    const result = await Kit.promiseAll([
      Promise.resolve(Result.err(firstError)),
      Promise.resolve(Result.err(secondError)),
    ]);

    expect(Result.isError(result)).toBeTruthy();
    const returnedError = Result.isError(result) ? result.error : undefined;
    expect(returnedError).toBe(firstError);
  });

  it("combines an empty list of Result promises", async () => {
    const result = await Kit.promiseAll([]);

    expect(result.unwrap()).toEqual([]);
  });
});
