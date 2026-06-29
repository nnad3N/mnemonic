import {
  BaseBasicBlocksPlugin,
  BaseBasicMarksPlugin,
} from "@platejs/basic-nodes";
import { MarkdownPlugin, remarkMention } from "@platejs/markdown";
import { BaseMentionPlugin } from "@platejs/mention";
import { MentionInputPlugin, MentionPlugin } from "@platejs/mention/react";
import { normalizeStaticValue } from "platejs";
import type { Value } from "platejs";
import type { PlateEditor } from "platejs/react";
import remarkGfm from "remark-gfm";

import type { ThreadInputLocation } from "../../../-chat-store";
import {
  ThreadMentionElement,
  ThreadMentionElementStatic,
  ThreadMentionInputElement,
} from "./mention-node";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins";

const sharedPlugins = [
  BaseBasicBlocksPlugin,
  BaseBasicMarksPlugin,
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkGfm, remarkMention],
    },
  }),
];

export const threadStaticEditorPlugins = [
  ...sharedPlugins,
  BaseMentionPlugin.withComponent(ThreadMentionElementStatic),
];

export const threadEditorPlugins = [
  ...sharedPlugins,
  MentionPlugin.configure({
    options: {
      insertSpaceAfterMention: true,
      triggerPreviousCharPattern: /^$|^[\s"']$/,
    },
  }).withComponent(ThreadMentionElement),
  MentionInputPlugin.withComponent(ThreadMentionInputElement),
  ThreadComposerKeyboardPlugin,
];

export const markdownToPlate = (editor: PlateEditor, markdown: string): Value =>
  editor.getApi(MarkdownPlugin).markdown.deserialize(markdown);

export const markdownToStaticPlate = (
  editor: PlateEditor,
  markdown: string
): Value => normalizeStaticValue(markdownToPlate(editor, markdown));

export const plateToMarkdown = (editor: PlateEditor, value?: Value): string =>
  editor.getApi(MarkdownPlugin).markdown.serialize({
    value: value ?? editor.children,
  });

export const getThreadEditorId = (
  threadId: string,
  location: ThreadInputLocation
) => `${threadId}-${location}`;
