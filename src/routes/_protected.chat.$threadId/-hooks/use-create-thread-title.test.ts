import { describe, expect, it } from "vitest";

import { sanitizeTitle } from "./use-create-thread-title";

describe("sanitizeTitle", () => {
  it("keeps a clean title untouched", () => {
    expect(sanitizeTitle("Quantum Computing Basics")).toBe("Quantum Computing Basics");
  });

  it("strips the quoting the model wraps titles in", () => {
    expect(sanitizeTitle('"Quantum Computing"')).toBe("Quantum Computing");
    expect(sanitizeTitle("'Quantum Computing'")).toBe("Quantum Computing");
    expect(sanitizeTitle("```Quantum Computing```")).toBe("Quantum Computing");
  });

  it("keeps quotes that are inside the title", () => {
    expect(sanitizeTitle(`What "ORM" Means`)).toBe(`What "ORM" Means`);
  });

  it("collapses newlines and runs of whitespace into single spaces", () => {
    expect(sanitizeTitle("Line one\n\nLine   two\t")).toBe("Line one Line two");
  });

  it("returns null for input that sanitizes to nothing", () => {
    expect(sanitizeTitle("")).toBeNull();
    expect(sanitizeTitle("   \n  ")).toBeNull();
    expect(sanitizeTitle(`"""`)).toBeNull();
  });

  it("truncates to the column limit without leaving trailing whitespace", () => {
    const title = sanitizeTitle(`${"a".repeat(254)} bbbb`);

    expect(title).toHaveLength(254);
    expect(title).toBe("a".repeat(254));
  });
});
