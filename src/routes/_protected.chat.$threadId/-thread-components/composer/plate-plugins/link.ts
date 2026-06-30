import type { PluginConfig, SlateEditor, TElement } from "platejs";
import { KEYS, createTSlatePlugin } from "platejs";

type InsertComposerLinkOptions = {
  url: string;
};

type ThreadLinkPluginConfig = PluginConfig<
  typeof KEYS.a,
  Record<string, never>,
  Record<string, never>,
  {
    insert: {
      link: (options: InsertComposerLinkOptions) => void;
    };
  }
>;

type InsertLinkNodeInput = {
  editor: SlateEditor;
  type: string;
  url: string;
};

const insertLinkNode = ({
  editor,
  type,
  url: urlString,
}: InsertLinkNodeInput) => {
  if (!URL.canParse(urlString)) {
    return;
  }

  const url = new URL(urlString);

  const { selection } = editor;

  const node = {
    type,
    children: [],
    url: url.href,
  };

  if (!selection) {
    editor.tf.insertNodes(node);
    return;
  }

  const anchor = selection.anchor;
  const anchorIndex = anchor.path.at(-1);

  editor.tf.insertNodes(node, { at: selection, select: false });

  if (anchorIndex === undefined) {
    return;
  }

  const voidPath = [...anchor.path.slice(0, -1), anchorIndex + 1];
  const afterPoint = editor.api.after(voidPath);

  if (afterPoint) {
    editor.tf.select(afterPoint);
  }
};

export const getComposerLinkLabel = (url: string) => {
  if (!URL.canParse(url)) {
    return url;
  }

  const parsed = new URL(url);

  if (parsed.pathname === "/") {
    return parsed.hostname;
  }

  return `${parsed.hostname}${parsed.pathname}`;
};

type ComposerLinkPasteSegment =
  | { type: "link"; url: URL }
  | { type: "text"; text: string };

const HTTP_URL_PATTERN = /https?:\/\/[^\s]+/gu;

export const parseComposerLinkPasteSegments = (
  input: string
): ComposerLinkPasteSegment[] | null => {
  const segments: ComposerLinkPasteSegment[] = [];
  let lastIndex = 0;
  let foundUrl = false;

  for (const match of input.matchAll(HTTP_URL_PATTERN)) {
    const urlString = match.at(0);
    const start = match.index;

    if (!urlString || !URL.canParse(urlString)) {
      continue;
    }

    const url = new URL(urlString);

    foundUrl = true;

    if (start > lastIndex) {
      segments.push({ type: "text", text: input.slice(lastIndex, start) });
    }

    segments.push({ type: "link", url });
    lastIndex = start + urlString.length;
  }

  if (!foundUrl) {
    return null;
  }

  if (lastIndex < input.length) {
    segments.push({ type: "text", text: input.slice(lastIndex) });
  }

  return segments;
};

type InsertComposerLinkInput = {
  editor: SlateEditor;
  url: string;
  trailingSpace?: boolean;
};

export const insertComposerLink = ({
  editor,
  url,
  trailingSpace = true,
}: InsertComposerLinkInput) => {
  insertLinkNode({ editor, type: KEYS.a, url });

  if (!trailingSpace) {
    return;
  }

  const { selection } = editor;

  if (!selection || editor.api.after(selection.anchor)) {
    return;
  }

  editor.tf.insertText(" ");
};

type ComposerLinkElement = TElement & {
  type: "a";
  url: string;
};

export const unlinkComposerLink = (
  editor: SlateEditor,
  element: ComposerLinkElement
) => {
  const at = editor.api.findPath(element);

  if (!at) {
    return;
  }

  editor.tf.withoutNormalizing(() => {
    editor.tf.removeNodes({ at });
    editor.tf.insertNodes({ text: element.url }, { at });
    const endPoint = editor.api.end(at);

    if (endPoint) {
      editor.tf.select(endPoint);
    }

    editor.tf.focus();
  });
};

export const removeComposerLink = (
  editor: SlateEditor,
  element: ComposerLinkElement
) => {
  const at = editor.api.findPath(element);

  if (!at) {
    return;
  }

  editor.tf.removeNodes({ at });
  editor.tf.focus();
};

export const ThreadLinkPlugin = createTSlatePlugin<ThreadLinkPluginConfig>({
  key: KEYS.a,
  node: {
    isElement: true,
    isInline: true,
    isMarkableVoid: true,
    isVoid: true,
  },
}).extendEditorTransforms(({ editor, type }) => ({
  insert: {
    link: ({ url }) => {
      insertLinkNode({ editor, type, url });
    },
  },
}));
