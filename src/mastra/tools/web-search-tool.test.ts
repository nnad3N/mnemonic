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

  it("skips a scraped document result", () => {
    expect(
      toSearchResult({
        html: "<p>hi</p>",
        markdown: "# Hi",
        metadata: { sourceURL: "https://docs.example.com" },
      }),
    ).toBeUndefined();
  });
});
