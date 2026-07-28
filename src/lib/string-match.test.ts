import { describe, expect, it } from "vitest";

import { matchesQuery } from "./string-match";

describe("matchesQuery", () => {
  it("matches empty and whitespace-only queries against any value", () => {
    expect(matchesQuery("Anything", "")).toBe(true);
    expect(matchesQuery("Anything", "   ")).toBe(true);
  });

  it("matches case-insensitively on a substring", () => {
    expect(matchesQuery("Hello World", "hello")).toBe(true);
    expect(matchesQuery("Hello World", "WORLD")).toBe(true);
    expect(matchesQuery("Hello World", "xyz")).toBe(false);
  });

  it("trims the query before matching", () => {
    expect(matchesQuery("Notes", "  notes  ")).toBe(true);
  });
});
