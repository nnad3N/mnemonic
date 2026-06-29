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
import { ThreadLinkElement, ThreadLinkElementStatic } from "./link-node";
import {
  ThreadMentionElement,
  ThreadMentionElementStatic,
  ThreadMentionInputElement,
} from "./mention-node";
import { ThreadComposerFilePlugin } from "./plate-plugins/file";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins/keyboard";
import { getComposerLinkLabel, ThreadLinkPlugin } from "./plate-plugins/link";
import { ThreadComposerPastePlugin } from "./plate-plugins/paste";

const sharedPlugins = [
  BaseBasicBlocksPlugin,
  BaseBasicMarksPlugin,
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkGfm, remarkMention],
      rules: {
        a: {
          serialize: (node) => {
            return {
              type: "link",
              children: [
                {
                  type: "text",
                  value: getComposerLinkLabel(node.url),
                },
              ],
              url: node.url,
            };
          },
        },
      },
    },
  }),
];

export const threadStaticEditorPlugins = [
  ...sharedPlugins,
  BaseMentionPlugin.withComponent(ThreadMentionElementStatic),
  ThreadLinkPlugin.withComponent(ThreadLinkElementStatic),
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
  ThreadLinkPlugin.withComponent(ThreadLinkElement),
  ThreadComposerKeyboardPlugin,
  ThreadComposerFilePlugin,
  ThreadComposerPastePlugin,
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
