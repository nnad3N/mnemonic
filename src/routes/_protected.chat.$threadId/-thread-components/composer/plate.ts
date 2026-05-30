import {
  BasicBlocksPlugin,
  BasicMarksPlugin,
} from "@platejs/basic-nodes/react";
import { MarkdownPlugin } from "@platejs/markdown";
import type { Value } from "platejs";
import type { PlateEditor } from "platejs/react";
import remarkGfm from "remark-gfm";

import type { ThreadInputLocation } from "../../-thread-store";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins";

export const threadEditorPlugins = [
  BasicBlocksPlugin,
  BasicMarksPlugin,
  ThreadComposerKeyboardPlugin,
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkGfm],
    },
  }),
];

export const markdownToPlateValue = (
  editor: PlateEditor,
  markdown: string
): Value => editor.getApi(MarkdownPlugin).markdown.deserialize(markdown);

export const plateValueToMarkdown = (
  editor: PlateEditor,
  value?: Value
): string =>
  editor.getApi(MarkdownPlugin).markdown.serialize({
    value: value ?? editor.children,
  });

export const getThreadEditorId = (
  threadId: string,
  location: ThreadInputLocation
) => `${threadId}-${location}`;
