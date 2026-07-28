import { describe, expect, it } from "vitest";

import { expectErr, expectOk } from "@/test/result";

import { runCode, SandboxArgsError, SandboxExecuteError } from "./run-code";

describe("runCode", () => {
  it("captures console logs and serializes the default export", async () => {
    const result = expectOk(await runCode(`console.log("hello"); export default ({ a: 1 });`));

    expect(result.logs).toContain("hello");
    expect(result.output).toEqual({ a: 1 });
  });

  it("returns undefined logs when the program logs nothing", async () => {
    const result = expectOk(await runCode(`export default 1 + 1;`));

    expect(result.logs).toBeUndefined();
    expect(result.output).toBe(2);
  });

  it("returns undefined output for non-JSON-serializable default exports", async () => {
    const result = expectOk(await runCode(`export default (() => {});`));

    expect(result.output).toBeUndefined();
  });

  it("returns a SandboxExecuteError for thrown JavaScript", async () => {
    const error = expectErr(await runCode(`throw new Error("boom")`));

    expect(SandboxExecuteError.is(error)).toBe(true);
    expect(error).toMatchObject({ message: expect.stringContaining("boom") });
    expect(error).not.toMatchObject({ isSyntaxError: true });
  });

  it("flags syntax errors", async () => {
    const error = expectErr(await runCode(`const x = ;`));

    expect(SandboxExecuteError.is(error)).toBe(true);
    expect(error).toMatchObject({ isSyntaxError: true });
  });

  it("can import the bundled mathjs module", async () => {
    const result = expectOk(
      await runCode(`
        import { evaluate } from "mathjs";
        export default evaluate("1 + 2");
      `),
    );

    expect(result.output).toBe(3);
  });

  it("injects omitted args as null on env.args", async () => {
    const result = expectOk(await runCode(`export default env.args;`));

    expect(result.output).toBeNull();
  });

  it("injects structured args onto env.args", async () => {
    const args = {
      text: "hello",
      nums: [1, 2],
      flag: true,
    };
    const result = expectOk(await runCode(`export default env.args;`, args));

    expect(result.output).toEqual(args);
  });

  it("returns a SandboxArgsError for non-JSON-serializable args", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const error = expectErr(await runCode(`export default env.args;`, circular));

    expect(SandboxArgsError.is(error)).toBe(true);
    expect(error).toMatchObject({ message: "args must be JSON-serializable" });
  });
});
