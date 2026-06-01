import {
  BaseBasicBlocksPlugin,
  BaseBasicMarksPlugin,
} from "@platejs/basic-nodes";
import { MarkdownPlugin } from "@platejs/markdown";
import type { Value } from "platejs";
import type { PlateEditor } from "platejs/react";
import remarkGfm from "remark-gfm";

import type { ThreadInputLocation } from "../../-thread-store";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins";

export const threadStaticEditorPlugins = [
  BaseBasicBlocksPlugin,
  BaseBasicMarksPlugin,
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkGfm],
    },
  }),
];

export const threadEditorPlugins = [
  ...threadStaticEditorPlugins,
  ThreadComposerKeyboardPlugin,
];

export const markdownToPlate = (editor: PlateEditor, markdown: string): Value =>
  editor.getApi(MarkdownPlugin).markdown.deserialize(markdown);

export const plateToMarkdown = (editor: PlateEditor, value?: Value): string =>
  editor.getApi(MarkdownPlugin).markdown.serialize({
    value: value ?? editor.children,
  });

export const getThreadEditorId = (
  threadId: string,
  location: ThreadInputLocation
) => `${threadId}-${location}`;
