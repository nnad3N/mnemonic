import {
  BasicMarksPlugin,
  BlockquotePlugin,
  HeadingPlugin,
  HorizontalRulePlugin,
} from "@platejs/basic-nodes/react";
import { FontSizePlugin } from "@platejs/basic-styles/react";
import { CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin } from "@platejs/code-block/react";
import { IndentPlugin } from "@platejs/indent/react";
import { LinkPlugin } from "@platejs/link/react";
import { BulletedListRules, OrderedListRules, TaskListRules } from "@platejs/list";
import { ListPlugin } from "@platejs/list/react";
import { MarkdownPlugin, remarkMdx } from "@platejs/markdown";
import { MathRules } from "@platejs/math";
import { EquationPlugin, InlineEquationPlugin } from "@platejs/math/react";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from "@platejs/table/react";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import { KEYS, TrailingBlockPlugin } from "platejs";
import remarkGfm from "remark-gfm";
import remarkMathExtended from "remark-math-extended";

import { NoteLinkToolbar } from "./link-toolbar";
import {
  NoteBlockList,
  NoteBlockquoteElement,
  NoteCodeBlockElement,
  NoteCodeLineElement,
  NoteCodeSyntaxLeaf,
  NoteEquationElement,
  NoteHorizontalRuleElement,
  NoteInlineEquationElement,
  NoteLinkElement,
  NoteTableCellElement,
  NoteTableCellHeaderElement,
  NoteTableElement,
  NoteTableRowElement,
} from "./nodes";
import { NoteSlashInputElement } from "./slash-input";

const indentTargets = [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.codeBlock];

const lowlight = createLowlight();

lowlight.register("bash", bash);
lowlight.register("css", css);
lowlight.register("go", go);
lowlight.register("html", xml);
lowlight.register("javascript", javascript);
lowlight.register("js", javascript);
lowlight.register("json", json);
lowlight.register("markdown", markdown);
lowlight.register("md", markdown);
// highlight.js has no mermaid grammar; plaintext keeps CodeBlockPlugin quiet while we render SVG.
lowlight.register("mermaid", plaintext);
lowlight.register("plaintext", plaintext);
lowlight.register("python", python);
lowlight.register("rust", rust);
lowlight.register("sql", sql);
lowlight.register("tsx", typescript);
lowlight.register("typescript", typescript);
lowlight.register("ts", typescript);
lowlight.register("xml", xml);
lowlight.register("yaml", yaml);
lowlight.register("yml", yaml);

export const notesEditorPlugins = [
  HeadingPlugin,
  BlockquotePlugin.withComponent(NoteBlockquoteElement),
  HorizontalRulePlugin.withComponent(NoteHorizontalRuleElement),
  BasicMarksPlugin,
  FontSizePlugin,
  CodeBlockPlugin.configure({
    node: { component: NoteCodeBlockElement },
    options: { lowlight },
  }),
  CodeLinePlugin.withComponent(NoteCodeLineElement),
  CodeSyntaxPlugin.withComponent(NoteCodeSyntaxLeaf),
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
  TablePlugin.configure({
    node: { component: NoteTableElement },
    options: { disableMerge: true },
  }),
  TableRowPlugin.withComponent(NoteTableRowElement),
  TableCellPlugin.withComponent(NoteTableCellElement),
  TableCellHeaderPlugin.withComponent(NoteTableCellHeaderElement),
  InlineEquationPlugin.configure({
    node: { component: NoteInlineEquationElement },
  }),
  EquationPlugin.configure({
    inputRules: [MathRules.markdown({ on: "break", variant: "$$" })],
    node: { component: NoteEquationElement },
  }),
  SlashPlugin.configure({
    options: {
      triggerQuery: (editor) =>
        !editor.api.some({ match: { type: editor.getType(KEYS.codeBlock) } }),
    },
  }),
  SlashInputPlugin.withComponent(NoteSlashInputElement),
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [
        // Font-size (and other style marks) serialize as mdxJsxTextElement spans.
        remarkMdx,
        remarkGfm,
        // SAFETY: MarkdownPlugin types remarkPlugins as Plugin[]; unified accepts [plugin, options].
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        [remarkMathExtended, { backslashDelimiters: true, singleDollarTextMath: false }] as never,
      ],
    },
  }),
  TrailingBlockPlugin,
];
