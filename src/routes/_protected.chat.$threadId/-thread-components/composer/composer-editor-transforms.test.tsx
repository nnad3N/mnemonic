import { ElementApi, TextApi } from "platejs";
import type { TElement } from "platejs";
import type { PlateEditor } from "platejs/react";
import { act } from "react";
import { assert, describe, expect, it } from "vitest";

import { createComposerEditor } from "@/test/create-composer-editor";

import { insertComposerLink, removeComposerLink, unlinkComposerLink } from "./plate-plugins/link";
import { insertComposerClipboardText } from "./plate-plugins/paste";

type ComposerLinkElement = TElement & {
  type: "a";
  url: string;
};

const paragraphChildren = (editor: PlateEditor) => {
  const paragraph = editor.children.at(0);
  assert(paragraph, "Expected a paragraph as the first editor child");
  expect(ElementApi.isElement(paragraph)).toBe(true);

  return paragraph.children;
};

const findLink = (nodes: readonly unknown[]): ComposerLinkElement | undefined => {
  for (const node of nodes) {
    if (ElementApi.isElement(node) && node.type === "a" && typeof node.url === "string") {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowed by type/url checks above.
      return node as ComposerLinkElement;
    }
  }

  return undefined;
};

/** Collapsed caret at `point` — the editor model "focus" after insert/unlink. */
const expectCollapsedCaret = (editor: PlateEditor, point: { path: number[]; offset: number }) => {
  expect(editor.selection).toEqual({
    anchor: point,
    focus: point,
  });
};

describe("insertComposerClipboardText", () => {
  it("inserts a single text run when there is no url (no markdown deserialize)", () => {
    const editor = createComposerEditor();

    act(() => {
      editor.tf.select([]);
      insertComposerClipboardText(editor, "hello **world**");
    });

    const children = paragraphChildren(editor);
    expect(children).toHaveLength(1);
    expect(children.at(0)).toEqual({ text: "hello **world**" });
  });

  it("builds text/link/text/link nodes for a multi-url paste", () => {
    const editor = createComposerEditor();

    act(() => {
      editor.tf.select([]);
      insertComposerClipboardText(editor, "see https://a.com/x and https://b.com/y");
    });

    const children = paragraphChildren(editor);
    const kinds = children.map((node) => {
      if (TextApi.isText(node)) {
        return { type: "text", text: node.text };
      }

      if (ElementApi.isElement(node) && typeof node.url === "string") {
        return { type: "link", url: node.url };
      }

      return { type: "other" };
    });

    expect(kinds).toEqual([
      { type: "text", text: "see " },
      { type: "link", url: "https://a.com/x" },
      { type: "text", text: " and " },
      { type: "link", url: "https://b.com/y" },
      // trailing space after the last link when nothing follows the caret
      { type: "text", text: " " },
    ]);
  });

  it("inserts subsequent typed text after the last link, not inside it", () => {
    const editor = createComposerEditor();

    act(() => {
      editor.tf.select([]);
      insertComposerClipboardText(editor, "see https://a.com/x");
      editor.tf.insertText("typed");
    });

    const children = paragraphChildren(editor);
    const last = children.at(-1);

    expect(TextApi.isText(last) && last.text.includes("typed")).toBe(true);

    const link = findLink(children);
    expect(link).toMatchObject({ type: "a", url: "https://a.com/x", children: [{ text: "" }] });
  });

  it("places the caret after the trailing space following the last pasted link", () => {
    const editor = createComposerEditor();

    act(() => {
      editor.tf.select([]);
      insertComposerClipboardText(editor, "see https://a.com/x");
    });

    // Children: ["see ", link, " "] — caret at end of the trailing space.
    expectCollapsedCaret(editor, { path: [0, 2], offset: 1 });
  });
});

describe("insertComposerLink", () => {
  it("ignores input that is not a parseable url", () => {
    const editor = createComposerEditor();

    act(() => {
      editor.tf.select([]);
      insertComposerLink({ editor, url: "not a url" });
    });

    expect(findLink(paragraphChildren(editor))).toBeUndefined();
  });

  it("adds a trailing space so the caret escapes the void link", () => {
    const editor = createComposerEditor();

    act(() => {
      editor.tf.select([]);
      insertComposerLink({ editor, url: "https://example.com/a" });
    });

    const children = paragraphChildren(editor);
    expect(children.at(-1)).toEqual({ text: " " });
    // Children: ["", link, " "] — caret at end of the trailing space, outside the void.
    expectCollapsedCaret(editor, { path: [0, 2], offset: 1 });
  });

  it("skips the trailing space when the caller opts out", () => {
    const editor = createComposerEditor();

    act(() => {
      editor.tf.select([]);
      insertComposerLink({ editor, url: "https://example.com/a", trailingSpace: false });
    });

    const children = paragraphChildren(editor);
    expect(children.map((node) => (TextApi.isText(node) ? node.text : "")).join("")).toBe("");
    // Children: ["", link, ""] — caret at the empty text after the void link.
    expectCollapsedCaret(editor, { path: [0, 2], offset: 0 });
  });

  it("skips the trailing space when text already follows the caret", () => {
    const editor = createComposerEditor([{ type: "p", children: [{ text: "tail" }] }]);

    act(() => {
      editor.tf.select({ path: [0, 0], offset: 0 });
      insertComposerLink({ editor, url: "https://example.com/a" });
    });

    const children = paragraphChildren(editor);
    expect(children.map((node) => (TextApi.isText(node) ? node.text : "")).join("")).toBe("tail");
    // Children: ["", link, "tail"] — caret at the start of the following text.
    expectCollapsedCaret(editor, { path: [0, 2], offset: 0 });
  });
});

describe("removeComposerLink", () => {
  it("deletes the link without leaving the url behind as text", () => {
    const editor = createComposerEditor([
      {
        type: "p",
        children: [
          { text: "before " },
          { type: "a", url: "https://example.com/docs", children: [{ text: "" }] },
          { text: " after" },
        ],
      },
    ]);

    const link = findLink(paragraphChildren(editor));
    expect(link).toBeDefined();

    act(() => {
      removeComposerLink(editor, link!);
    });

    const children = paragraphChildren(editor);
    expect(findLink(children)).toBeUndefined();
    expect(children.map((node) => (TextApi.isText(node) ? node.text : "")).join("")).toBe(
      "before  after",
    );
  });
});

describe("unlinkComposerLink", () => {
  it("replaces the link node with plain text containing the url and keeps surrounding text", () => {
    const editor = createComposerEditor([
      {
        type: "p",
        children: [
          { text: "before " },
          {
            type: "a",
            url: "https://example.com/docs",
            children: [{ text: "" }],
          },
          { text: " after" },
        ],
      },
    ]);

    const link = findLink(paragraphChildren(editor));
    expect(link).toBeDefined();

    act(() => {
      unlinkComposerLink(editor, link!);
    });

    const children = paragraphChildren(editor);
    expect(findLink(children)).toBeUndefined();
    // Adjacent text nodes are normalized into one run; the important invariant is
    // that the url became plain text and the neighbors survived.
    expect(children.map((node) => (TextApi.isText(node) ? node.text : null)).join("")).toBe(
      "before https://example.com/docs after",
    );
  });

  it("places the caret at the end of the unlinked url text", () => {
    const url = "https://example.com/docs";
    const editor = createComposerEditor([
      {
        type: "p",
        children: [
          { text: "before " },
          { type: "a", url, children: [{ text: "" }] },
          { text: " after" },
        ],
      },
    ]);

    const link = findLink(paragraphChildren(editor));
    expect(link).toBeDefined();

    act(() => {
      unlinkComposerLink(editor, link!);
    });

    // Normalized to one text run; caret sits at the end of the inserted url.
    expectCollapsedCaret(editor, { path: [0, 0], offset: `before ${url}`.length });
  });
});
