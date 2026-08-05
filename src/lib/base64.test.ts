import { describe, expect, it } from "vitest";

import { decodeBase64DataUrl } from "./base64";

describe("decodeBase64DataUrl", () => {
  it("decodes a base64 data URL", () => {
    const bytes = new TextEncoder().encode("hello");
    const data = `data:text/plain;base64,${Buffer.from(bytes).toString("base64")}`;

    expect(decodeBase64DataUrl(data)).toEqual(bytes);
  });

  it("accepts uppercase BASE64 in the media type parameters", () => {
    const bytes = new TextEncoder().encode("hello");
    const data = `data:text/plain;BASE64,${Buffer.from(bytes).toString("base64")}`;

    expect(decodeBase64DataUrl(data)).toEqual(bytes);
  });

  it("returns null for non-data URLs", () => {
    expect(decodeBase64DataUrl("https://example.com/file.txt")).toBeNull();
  });

  it("returns null when the comma separator is missing", () => {
    expect(decodeBase64DataUrl("data:text/plain;base64")).toBeNull();
  });

  it("returns null when the base64 parameter is missing", () => {
    expect(decodeBase64DataUrl("data:text/plain,aGVsbG8=")).toBeNull();
  });

  it("returns null for invalid base64 payloads", () => {
    expect(decodeBase64DataUrl("data:text/plain;base64,!!!")).toBeNull();
  });
});
