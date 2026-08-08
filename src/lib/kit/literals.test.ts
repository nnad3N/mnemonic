import { describe, expect, it } from "vitest";

import * as Kit from ".";

describe("Kit.literals.from", () => {
  const status = Kit.literals.from()(["pending", "done"]);

  it("keeps the values in order", () => {
    expect(status.values).toEqual(["pending", "done"]);
  });

  it("accepts members and rejects non-members", () => {
    expect(status.is("pending")).toBe(true);
    expect(status.is("done")).toBe(true);
    expect(status.is("failed")).toBe(false);
  });

  it("rejects values that aren't strings", () => {
    expect(status.is(null)).toBe(false);
    expect(status.is(undefined)).toBe(false);
    expect(status.is(123)).toBe(false);
    expect(status.is({})).toBe(false);
  });

  it("holds non-string values too", () => {
    const port = Kit.literals.from()([80, 443]);

    expect(port.is(443)).toBe(true);
    expect(port.is(8080)).toBe(false);
    expect(port.is("443")).toBe(false);
  });
});
