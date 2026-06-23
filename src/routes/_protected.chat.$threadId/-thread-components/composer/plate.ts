import {
  BaseBasicBlocksPlugin,
  BaseBasicMarksPlugin,
} from "@platejs/basic-nodes";
import { MarkdownPlugin } from "@platejs/markdown";
import { MentionInputPlugin, MentionPlugin } from "@platejs/mention/react";
import type { Value } from "platejs";
import type { PlateEditor } from "platejs/react";
import remarkGfm from "remark-gfm";

import type { ThreadInputLocation } from "../../-thread-store";
import {
  ThreadMentionElement,
  ThreadMentionInputElement,
} from "./mention-node";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins";

export const getThreadStaticEditorPlugins = (topicId?: string) => [
  BaseBasicBlocksPlugin,
  BaseBasicMarksPlugin,
  MentionPlugin.configure({
    enabled: !!topicId,
    options: {
      insertSpaceAfterMention: true,
      triggerPreviousCharPattern: /^$|^[\s"']$/,
    },
  }).withComponent(ThreadMentionElement),
  MentionInputPlugin.configure({
    enabled: !!topicId,
  }).withComponent(ThreadMentionInputElement),
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkGfm],
    },
  }),
];

export const getThreadEditorPlugins = (topicId?: string) => [
  ...getThreadStaticEditorPlugins(topicId),
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
