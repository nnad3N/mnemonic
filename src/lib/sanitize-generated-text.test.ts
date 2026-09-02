import { describe, expect, it } from "vitest";

import { sanitizeGeneratedText } from "./sanitize-generated-text";

const sanitize = (value: string) => sanitizeGeneratedText({ maxLength: 255, value });

describe("sanitizeGeneratedText", () => {
  it("keeps clean text untouched", () => {
    expect(sanitize("Quantum Computing Basics")).toBe("Quantum Computing Basics");
  });

  it("strips the quoting the model wraps output in", () => {
    expect(sanitize('"Quantum Computing"')).toBe("Quantum Computing");
    expect(sanitize("'Quantum Computing'")).toBe("Quantum Computing");
    expect(sanitize("```Quantum Computing```")).toBe("Quantum Computing");
  });

  it("keeps quotes that are inside the text", () => {
    expect(sanitize(`What "ORM" Means`)).toBe(`What "ORM" Means`);
  });

  it("collapses newlines and runs of whitespace into single spaces", () => {
    expect(sanitize("Line one\n\nLine   two\t")).toBe("Line one Line two");
  });

  it("returns null for input that sanitizes to nothing", () => {
    expect(sanitize("")).toBeNull();
    expect(sanitize("   \n  ")).toBeNull();
    expect(sanitize(`"""`)).toBeNull();
  });

  it("truncates to the limit without leaving trailing whitespace", () => {
    const text = sanitize(`${"a".repeat(254)} bbbb`);

    expect(text).toHaveLength(254);
    expect(text).toBe("a".repeat(254));
  });
});
