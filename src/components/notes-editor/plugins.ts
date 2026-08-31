import {
  BasicMarksPlugin,
  BlockquotePlugin,
  HeadingPlugin,
  HorizontalRulePlugin,
} from "@platejs/basic-nodes/react";
import { FontSizePlugin } from "@platejs/basic-styles/react";
import { CodeBlockPlugin, CodeLinePlugin } from "@platejs/code-block/react";
import { IndentPlugin } from "@platejs/indent/react";
import { LinkPlugin } from "@platejs/link/react";
import { BulletedListRules, OrderedListRules, TaskListRules } from "@platejs/list";
import { ListPlugin } from "@platejs/list/react";
import { MarkdownPlugin } from "@platejs/markdown";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import { KEYS, TrailingBlockPlugin } from "platejs";
import remarkGfm from "remark-gfm";

import { NoteLinkToolbar } from "./link-toolbar";
import {
  NoteBlockList,
  NoteBlockquoteElement,
  NoteCodeBlockElement,
  NoteHorizontalRuleElement,
  NoteLinkElement,
} from "./nodes";
import { NoteSlashInputElement } from "./slash-input";

const indentTargets = [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.codeBlock];

export const notesEditorPlugins = [
  HeadingPlugin,
  BlockquotePlugin.withComponent(NoteBlockquoteElement),
  HorizontalRulePlugin.withComponent(NoteHorizontalRuleElement),
  BasicMarksPlugin,
  FontSizePlugin,
  CodeBlockPlugin.withComponent(NoteCodeBlockElement),
  CodeLinePlugin,
  IndentPlugin.configure({ inject: { targetPlugins: indentTargets } }),
  ListPlugin.configure({
    inject: { targetPlugins: indentTargets },
    inputRules: [
      BulletedListRules.markdown({ variant: "-" }),
      OrderedListRules.markdown({ variant: "." }),
      TaskListRules.markdown({ checked: false }),
    ],
    render: { belowNodes: NoteBlockList },
  }),
  LinkPlugin.configure({
    render: { afterEditable: NoteLinkToolbar },
  }).withComponent(NoteLinkElement),
  SlashPlugin.configure({
    options: {
      triggerQuery: (editor) =>
        !editor.api.some({ match: { type: editor.getType(KEYS.codeBlock) } }),
    },
  }),
  SlashInputPlugin.withComponent(NoteSlashInputElement),
  MarkdownPlugin.configure({ options: { remarkPlugins: [remarkGfm] } }),
  TrailingBlockPlugin,
];
