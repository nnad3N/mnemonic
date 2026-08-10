import { describe, expect, it } from "vitest";

import { emailMatchesPatterns } from "@/lib/better-auth/allowed-emails";

describe("emailMatchesPatterns", () => {
  it("matches an exact email and rejects one not listed", () => {
    expect(emailMatchesPatterns("a@x.com,b@y.com", "b@y.com")).toBe(true);
    expect(emailMatchesPatterns("a@x.com,b@y.com", "c@z.com")).toBe(false);
  });

  it("matches any username through a domain wildcard, but not other domains", () => {
    expect(emailMatchesPatterns("*@x.com", "anyone@x.com")).toBe(true);
    expect(emailMatchesPatterns("*@x.com", "anyone@not-x.com")).toBe(false);
  });

  it("does not let a wildcard match the domain as a username suffix", () => {
    expect(emailMatchesPatterns("*@x.com", "userx.com@y.com")).toBe(false);
  });

  it("ignores case and whitespace around entries", () => {
    expect(emailMatchesPatterns(" A@X.com , *@Y.com ", "a@x.COM")).toBe(true);
    expect(emailMatchesPatterns(" A@X.com , *@Y.com ", "b@y.COM")).toBe(true);
  });
});
