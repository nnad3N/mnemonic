import { describe, expect, it } from "vitest";

import { isUserProvidedUrl } from "./web-fetch-tool.server";

describe("isUserProvidedUrl", () => {
  it("matches through canonicalization", () => {
    expect(isUserProvidedUrl("https://example.com/", ["see https://example.com"])).toBe(true);
  });

  it("matches a markdown-wrapped link with trailing punctuation", () => {
    expect(isUserProvidedUrl("https://example.com/a", ["[here](https://example.com/a)."])).toBe(
      true,
    );
  });

  it("rejects a link absent from the user's messages", () => {
    expect(isUserProvidedUrl("https://example.com/other", ["see https://example.com/a"])).toBe(
      false,
    );
  });

  it.each([
    ["a different path on the same domain", "https://example.com/b"],
    ["a path extended beyond the given link", "https://example.com/a/b"],
    ["the given link with its query dropped", "https://example.com/a"],
    ["a subdomain of the given host", "https://sub.example.com/"],
    ["a downgraded scheme", "http://example.com/"],
    ["the given host demoted to userinfo", "https://example.com@evil.com/"],
  ])("rejects %s", (_case, url) => {
    expect(isUserProvidedUrl(url, ["see https://example.com/a?x=1 and https://example.com"])).toBe(
      false,
    );
  });

  it("rejects a relative markdown link resolved against a given host", () => {
    expect(
      isUserProvidedUrl("https://example.com/docs/setup", [
        "see https://example.com and [setup](/docs/setup)",
      ]),
    ).toBe(false);
  });
});
