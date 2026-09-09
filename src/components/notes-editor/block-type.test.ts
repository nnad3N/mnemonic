import { BaseIndentPlugin } from "@platejs/indent";
import { BaseListPlugin, toggleList } from "@platejs/list";
import { createSlateEditor, KEYS } from "platejs";
import { describe, expect, it } from "vitest";

import { getBlockType, setBlockType } from "./block-type";

const indentTargets = [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.codeBlock];

/** Real plugins build the nodes, so a change to their shape breaks these instead of passing. */
const createEditor = () =>
  createSlateEditor({
    plugins: [
      BaseIndentPlugin.configure({ inject: { targetPlugins: indentTargets } }),
      BaseListPlugin.configure({ inject: { targetPlugins: indentTargets } }),
    ],
    selection: { anchor: { offset: 0, path: [0, 0] }, focus: { offset: 0, path: [0, 0] } },
    value: [{ children: [{ text: "note" }], type: KEYS.p }],
  });

const firstBlock = (editor: ReturnType<typeof createEditor>) => editor.children[0];

describe("getBlockType", () => {
  it("reads a bulleted list from the props the list plugin writes", () => {
    const editor = createEditor();

    toggleList(editor, { listStyleType: KEYS.ul });

    expect(getBlockType(firstBlock(editor))).toBe(KEYS.ul);
  });

  it("tells an ordered list apart from a bulleted one", () => {
    const editor = createEditor();

    toggleList(editor, { listStyleType: KEYS.ol });

    expect(getBlockType(firstBlock(editor))).toBe(KEYS.ol);
  });

  it("keeps a to-do list distinct from the bulleted list it is built on", () => {
    const editor = createEditor();

    toggleList(editor, { listStyleType: KEYS.listTodo });

    expect(getBlockType(firstBlock(editor))).toBe(KEYS.listTodo);
  });

  it("reports a code line as its code block", () => {
    const editor = createEditor();

    editor.tf.setNodes({ type: KEYS.codeLine });

    expect(getBlockType(firstBlock(editor))).toBe(KEYS.codeBlock);
  });
});

describe("setBlockType", () => {
  it("turns a paragraph into a list", () => {
    const editor = createEditor();

    setBlockType(editor, KEYS.ol);

    expect(getBlockType(firstBlock(editor))).toBe(KEYS.ol);
  });

  it("strips the list props when turning a list item into a heading", () => {
    const editor = createEditor();

    toggleList(editor, { listStyleType: KEYS.ul });
    setBlockType(editor, KEYS.h2);

    expect(firstBlock(editor)).toMatchObject({ type: KEYS.h2 });
    expect(getBlockType(firstBlock(editor))).toBe(KEYS.h2);
  });

  it("swaps one list style for another", () => {
    const editor = createEditor();

    toggleList(editor, { listStyleType: KEYS.ul });
    setBlockType(editor, KEYS.listTodo);

    expect(getBlockType(firstBlock(editor))).toBe(KEYS.listTodo);
  });
});
