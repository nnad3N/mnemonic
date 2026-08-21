import { MarkdownPlugin } from "@platejs/markdown";
import { normalizeStaticValue } from "platejs";
import type { Value } from "platejs";
import type { PlateEditor } from "platejs/react";

export const markdownToPlate = (editor: PlateEditor, markdown: string): Value =>
  editor.getApi(MarkdownPlugin).markdown.deserialize(markdown);

export const markdownToStaticPlate = (editor: PlateEditor, markdown: string): Value =>
  normalizeStaticValue(markdownToPlate(editor, markdown));

export const plateToMarkdown = (editor: PlateEditor, value?: Value): string =>
  editor.getApi(MarkdownPlugin).markdown.serialize({
    value: value ?? editor.children,
  });
