import type { Value } from "platejs";
import { describe, expect, it } from "vitest";

import { createComposerEditor } from "@/test/create-composer-editor";

import { hasComposerContent } from "../../-hooks/use-composer-actions";
import { getMentionKey } from "./plate-plugins/mention-key";

const paragraphHasContent = (value: Value) => {
  const editor = createComposerEditor(value);
  const root = editor.children.at(0);

  expect(root).toBeDefined();
  return hasComposerContent(editor, root!);
};

describe("hasComposerContent", () => {
  it("treats an empty paragraph as empty", () => {
    expect(paragraphHasContent([{ type: "p", children: [{ text: "" }] }])).toBe(false);
  });

  it("treats whitespace-only text as empty", () => {
    expect(paragraphHasContent([{ type: "p", children: [{ text: "   " }] }])).toBe(false);
  });

  it("treats newlines-only text as empty", () => {
    expect(paragraphHasContent([{ type: "p", children: [{ text: "\n\n" }] }])).toBe(false);
  });

  it("treats non-empty text as content even with surrounding whitespace", () => {
    expect(paragraphHasContent([{ type: "p", children: [{ text: "  hello  " }] }])).toBe(true);
  });

  it("treats a mention chip as content even though its text child is empty", () => {
    expect(
      paragraphHasContent([
        {
          type: "p",
          children: [
            { text: "" },
            {
              type: "mention",
              key: getMentionKey({ type: "file", value: "V1StGXR8_Z5jdHi6B-myT" }),
              value: "doc.pdf",
              children: [{ text: "" }],
            },
            { text: "" },
          ],
        },
      ]),
    ).toBe(true);
  });

  it("treats a link chip as content even though its text child is empty", () => {
    expect(
      paragraphHasContent([
        {
          type: "p",
          children: [
            { text: "" },
            {
              type: "a",
              url: "https://example.com",
              children: [{ text: "" }],
            },
            { text: "" },
          ],
        },
      ]),
    ).toBe(true);
  });
});
