import { describe, expect, it } from "vitest";

import { expectErr, expectOk } from "@/test/result";

import { runCode, SandboxExecuteError } from "./run-code";

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
        import math from "mathjs";
        export default math.evaluate("1 + 2");
      `),
    );

    expect(result.output).toBe(3);
  });

  it("can import the bundled papaparse module", async () => {
    const result = expectOk(
      await runCode(`
        import Papa from "papaparse";
        export default Papa.parse("a,b\\n1,2", { header: true }).data;
      `),
    );

    expect(result.output).toEqual([{ a: "1", b: "2" }]);
  });

  it("injects structured args onto env.args", async () => {
    const args = {
      text: "hello",
      nums: [1, 2],
      flag: true,
    };
    const result = expectOk(await runCode(`export default env.args;`, { args }));

    expect(result.output).toEqual(args);
  });

  it("injects file onto env.file", async () => {
    const file = {
      contents: "a,b\n1,2\n",
      filename: "data.csv",
      size: 8,
      mimeType: "text/csv",
    };
    const result = expectOk(await runCode(`export default env.file;`, { file }));

    expect(result.output).toEqual(file);
  });
});
