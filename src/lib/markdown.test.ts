import { describe, expect, it } from "vitest";

import { markdownToText } from "./markdown";

describe("markdownToText", () => {
  it("keeps prose, inline code and code blocks, drops markdown syntax", () => {
    const markdown = "# Title\n\nsome **bold** and `code`\n\n```ts\nconst x = 1;\n```\n";

    expect(markdownToText(markdown)).toBe("Title\nsome bold and code\nconst x = 1;\n");
  });

  it("produces identical text for syntax-only changes", () => {
    expect(markdownToText("## Heading\n\n- item one\n- item two\n")).toBe(
      markdownToText("# Heading\n\n1. item one\n2. item two\n"),
    );
  });
});
