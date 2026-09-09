import { KEYS } from "platejs";
import { createPlateEditor } from "platejs/react";
import { describe, expect, it } from "vitest";

import { markdownToPlate, plateToMarkdown } from "@/lib/plate";

import { notesEditorPlugins } from "./plugins";

const createEditor = (markdown = "") => {
  const editor = createPlateEditor({ plugins: notesEditorPlugins });

  if (markdown.length > 0) {
    editor.tf.setValue(markdownToPlate(editor, markdown));
  }

  return editor;
};

describe("notes markdown round-trip", () => {
  it("deserializes a GFM table and serializes pipe rows", () => {
    const markdown = `| A | B |
| --- | --- |
| 1 | 2 |
`;
    const editor = createEditor(markdown);

    expect(editor.children[0]).toMatchObject({ type: KEYS.table });
    expect(plateToMarkdown(editor)).toContain("| A | B |");
    expect(plateToMarkdown(editor)).toContain("| 1 | 2 |");
  });

  it("turns backslash math into equation nodes and leaves dollar amounts as text", () => {
    const editor = createEditor("Price is $100 and inline \\(x\\) with block\n\n\\[e=mc^2\\]\n");
    const markdown = plateToMarkdown(editor);

    expect(markdown).toContain("$100");
    expect(editor.children.some((node) => node.type === KEYS.equation)).toBe(true);
    expect(
      [...editor.api.nodes({ at: [], match: { type: KEYS.inlineEquation } })].length,
    ).toBeGreaterThan(0);
  });

  it("keeps fenced code languages, including mermaid", () => {
    const editor = createEditor(`\`\`\`typescript
const x = 1
\`\`\`

\`\`\`mermaid
flowchart LR
  a --> b
\`\`\`
`);

    const codeBlocks = editor.children.filter((node) => node.type === KEYS.codeBlock);

    expect(codeBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lang: "typescript", type: KEYS.codeBlock }),
        expect.objectContaining({ lang: "mermaid", type: KEYS.codeBlock }),
      ]),
    );

    const markdown = plateToMarkdown(editor);

    expect(markdown).toContain("```typescript");
    expect(markdown).toContain("```mermaid");
  });

  it("serializes font-size marks as MDX spans", () => {
    const editor = createEditor();

    editor.tf.setValue([
      {
        children: [{ [KEYS.fontSize]: "18px", text: "Sized" }],
        type: KEYS.p,
      },
    ]);

    const markdown = plateToMarkdown(editor);

    expect(markdown).toContain("font-size: 18px");
    expect(markdown).toContain("Sized");
  });
});
