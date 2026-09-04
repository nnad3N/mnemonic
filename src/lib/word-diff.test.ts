import { describe, expect, it } from "vitest";

import { diffWordCounts } from "./word-diff";

describe("diffWordCounts", () => {
  it("pairs an adjacent removal and addition into replacements plus the remainder", () => {
    expect(diffWordCounts("one two three", "one four five six")).toEqual({
      added: 1,
      removed: 0,
      replaced: 2,
    });
  });

  it("counts plain additions and removals", () => {
    expect(diffWordCounts("alpha beta", "alpha beta gamma")).toEqual({
      added: 1,
      removed: 0,
      replaced: 0,
    });
    expect(diffWordCounts("alpha beta gamma", "alpha gamma")).toEqual({
      added: 0,
      removed: 1,
      replaced: 0,
    });
  });

  it("reports zeroes for identical content", () => {
    expect(diffWordCounts("same text", "same text")).toEqual({
      added: 0,
      removed: 0,
      replaced: 0,
    });
  });
});
