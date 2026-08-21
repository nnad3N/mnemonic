import { describe, expect, it } from "vitest";

import { plateToMarkdown } from "@/lib/plate";
import { createComposerEditor } from "@/test/create-composer-editor";

import { getComposerLinkLabel, parseComposerLinkPasteSegments } from "./plate-plugins/link";

describe("plateToMarkdown", () => {
  it("serializes a mention key without percent-encoding the double colon", () => {
    const editor = createComposerEditor([
      {
        type: "p",
        children: [
          { text: "see " },
          {
            type: "mention",
            key: "attachment::abc123",
            value: "report.csv",
            children: [{ text: "" }],
          },
          { text: "" },
        ],
      },
    ]);

    expect(plateToMarkdown(editor)).toContain("see [report.csv](mention:attachment::abc123)");
  });
});

describe("getComposerLinkLabel", () => {
  it("returns the hostname for bare origins", () => {
    expect(getComposerLinkLabel("https://example.com/")).toBe("example.com");
  });

  it("includes pathname when present", () => {
    expect(getComposerLinkLabel("https://example.com/docs/a")).toBe("example.com/docs/a");
  });

  it("returns the raw string when the url is invalid", () => {
    expect(getComposerLinkLabel("not a url")).toBe("not a url");
  });
});

describe("parseComposerLinkPasteSegments", () => {
  it("returns null when there is no url so paste inserts raw text", () => {
    expect(parseComposerLinkPasteSegments("plain text")).toBeNull();
  });

  it("returns a single link segment for a bare url", () => {
    expect(parseComposerLinkPasteSegments("https://example.com/a")).toEqual([
      { type: "link", url: new URL("https://example.com/a") },
    ]);
  });

  it("keeps text before, after, and between urls", () => {
    expect(parseComposerLinkPasteSegments("see https://a.com/x and https://b.com/y end")).toEqual([
      { type: "text", text: "see " },
      { type: "link", url: new URL("https://a.com/x") },
      { type: "text", text: " and " },
      { type: "link", url: new URL("https://b.com/y") },
      { type: "text", text: " end" },
    ]);
  });

  it("returns null when the only regex hit is not a parseable url", () => {
    // `https://[` matches HTTP_URL_PATTERN but URL.canParse rejects it, so no
    // link is found and the caller falls back to inserting the whole raw text.
    expect(parseComposerLinkPasteSegments("before https://[ after")).toBeNull();
  });

  it("keeps an unparseable hit as text when another url in the same paste is valid", () => {
    expect(parseComposerLinkPasteSegments("https://[ then https://ok.com/a")).toEqual([
      { type: "text", text: "https://[ then " },
      { type: "link", url: new URL("https://ok.com/a") },
    ]);
  });

  it("includes trailing punctuation in the url because the matcher is [^\\s]+", () => {
    // Pin current behavior: the period is swallowed into the URL, not left as text.
    expect(parseComposerLinkPasteSegments("https://x.com/a.")).toEqual([
      { type: "link", url: new URL("https://x.com/a.") },
    ]);
  });
});
