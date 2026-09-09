import { BaseBasicBlocksPlugin, BaseBasicMarksPlugin } from "@platejs/basic-nodes";
import { MarkdownPlugin, remarkMention } from "@platejs/markdown";
import { BaseMentionPlugin } from "@platejs/mention";
import { MentionInputPlugin, MentionPlugin } from "@platejs/mention/react";
import remarkGfm from "remark-gfm";

import { toMentionUrl } from "@/lib/mention-key";

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
        // The default rule percent-encodes the id, so the model would see
        // `attachment%3A%3A<sha>` instead of the `type::value` key tools expect.
        mention: {
          serialize: (node) => ({
            type: "link",
            children: [{ type: "text", value: node.value }],
            // oxlint-disable-next-line anti-slop/no-runtime-typeof
            url: toMentionUrl(typeof node.key === "string" ? node.key : node.value),
          }),
        },
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

export const getThreadEditorId = (threadId: string, location: ThreadInputLocation) =>
  `${threadId}-${location}`;
