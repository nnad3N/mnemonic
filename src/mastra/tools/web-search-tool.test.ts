import { describe, expect, it } from "vitest";

import { toSearchResult } from "./web-search-tool";

describe("toSearchResult", () => {
  it("maps a web search hit", () => {
    expect(
      toSearchResult({
        url: "https://example.com",
        title: "Example",
        description: "Desc",
      }),
    ).toEqual({
      url: "https://example.com",
      title: "Example",
      description: "Desc",
    });
  });

  it("returns undefined when a web hit has no url", () => {
    expect(toSearchResult({ url: "", title: "Missing" })).toBeUndefined();
  });

  it("maps a document result from metadata sourceURL", () => {
    expect(
      toSearchResult({
        html: "<p>hi</p>",
        markdown: "# Hi",
        metadata: {
          sourceURL: "https://docs.example.com",
          title: "Docs",
          description: "About",
        },
      }),
    ).toEqual({
      url: "https://docs.example.com",
      title: "Docs",
      description: "About",
      markdown: "# Hi",
    });
  });

  it("returns undefined when a document has no url metadata", () => {
    expect(
      toSearchResult({
        html: "<p>hi</p>",
        metadata: { title: "No url" },
      }),
    ).toBeUndefined();
  });
});
