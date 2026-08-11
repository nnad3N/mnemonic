import { describe, expect, it } from "vitest";

import { expectErr, expectOk } from "@/test/result";

import * as Kit from ".";

describe("Kit.cookies", () => {
  it("reads back a value it wrote", () => {
    Kit.cookies.set({ name: "round_trip", value: "16rem" });

    expect(expectOk(Kit.cookies.get("round_trip"))).toBe("16rem");
  });

  it("round-trips values containing cookie separators", () => {
    Kit.cookies.set({ name: "encoded", value: "a; b=c" });

    expect(expectOk(Kit.cookies.get("encoded"))).toBe("a; b=c");
  });

  it("matches the whole name, not a prefix of another cookie", () => {
    Kit.cookies.set({ name: "sidebar", value: "open" });
    Kit.cookies.set({ name: "sidebar_width", value: "240px" });

    expect(expectOk(Kit.cookies.get("sidebar"))).toBe("open");
    expect(expectOk(Kit.cookies.get("sidebar_width"))).toBe("240px");
  });

  it("errors when the cookie is not set", () => {
    expectErr(Kit.cookies.get("never_written"));
  });
});
