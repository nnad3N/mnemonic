import { describe, expect, it } from "vitest";

import { parseQuery } from "./use-media-query";

describe("parseQuery", () => {
  it("passes through raw media query strings", () => {
    expect(parseQuery("(prefers-color-scheme: dark)")).toBe("(prefers-color-scheme: dark)");
  });

  it("expands breakpoint tokens", () => {
    expect(parseQuery("md")).toBe("(min-width: 800px)");
    expect(parseQuery("max-md")).toBe("(max-width: 799px)");
    expect(parseQuery("md:max-lg")).toBe("(min-width: 800px) and (max-width: 1023px)");
  });

  it("builds object queries", () => {
    expect(parseQuery({ min: "sm", max: "lg", pointer: "fine" })).toBe(
      "(min-width: 640px) and (max-width: 1023px) and (pointer: fine)",
    );
  });

  it("falls back to min-width 0 for an empty object query", () => {
    expect(parseQuery({})).toBe("(min-width: 0px)");
  });
});
