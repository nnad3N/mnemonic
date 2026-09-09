import { describe, expect, it } from "vitest";

import { docs, getDocsMember, searchDocs } from "@/lib/docs/docs-index";

describe("generated docs", () => {
  it("papaparse contains exactly the sandbox-supported members", () => {
    expect(docs.papaparse.library.members.map((member) => member.name)).toMatchInlineSnapshot(`
      [
        "BAD_DELIMITERS",
        "BYTE_ORDER_MARK",
        "DefaultDelimiter",
        "parse",
        "ParseConfig",
        "ParseError",
        "ParseMeta",
        "Parser",
        "ParseResult",
        "ParseStepResult",
        "RECORD_SEP",
        "UNIT_SEP",
        "unparse",
        "UnparseConfig",
        "UnparseObject",
      ]
    `);
  });

  it("minisearch contains the public MiniSearch surface and its exported types", () => {
    expect(docs.minisearch.library.members.map((member) => member.name)).toMatchSnapshot();
  });

  it("mathjs contains exactly the namespace-importable members", () => {
    expect(docs.mathjs.library.members.map((member) => member.name)).toMatchSnapshot();
  });

  it("collapses same-prose overloads and merges embedded help", () => {
    expect(getDocsMember("mathjs", "std")).toMatchSnapshot();
  });

  it("keeps every description when overloads document different behaviour", () => {
    expect(getDocsMember("mathjs", "map")?.description).toMatchSnapshot();
  });

  it("reads papaparse docs from the vendored types", () => {
    expect(getDocsMember("papaparse", "parse")).toMatchSnapshot();
  });
});

describe("getDocsMember", () => {
  it("matches names case-insensitively", () => {
    expect(getDocsMember("mathjs", "STD")?.name).toBe("std");
  });
});

describe("searchDocs", () => {
  it("resolves search hits back to the members they came from", () => {
    const [first] = searchDocs({ name: "mathjs", query: "standard deviation", limit: 3 });

    expect(first.name).toBe("std");
  });
});
