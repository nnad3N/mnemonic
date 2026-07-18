import type { PluginConfig, SlateEditor } from "platejs";
import { createTPlatePlugin } from "platejs/react";

import { insertComposerLink, parseComposerLinkPasteSegments } from "./link";

type ThreadComposerPasteConfig = PluginConfig<"thread-composer-paste">;

/** Insert clipboard/drop text as-is; only promote bare http(s) URLs to link nodes. */
export const insertComposerClipboardText = (editor: SlateEditor, text: string) => {
  const segments = parseComposerLinkPasteSegments(text);

  if (!segments) {
    editor.tf.insertText(text);
    return;
  }

  for (const [index, segment] of segments.entries()) {
    if (segment.type === "text") {
      editor.tf.insertText(segment.text);
      continue;
    }

    insertComposerLink({
      editor,
      url: segment.url.href,
      trailingSpace: index === segments.length - 1,
    });
  }
};

export const ThreadComposerPastePlugin = createTPlatePlugin<ThreadComposerPasteConfig>({
  key: "thread-composer-paste",
  handlers: {
    onPaste: ({ editor, event }) => {
      const files = event.clipboardData.files;

      if (files.length > 0) {
        return false;
      }

      const text = event.clipboardData.getData("text/plain");

      if (!text) {
        return false;
      }

      // Avoid MarkdownPlugin's text/plain → markdown deserialize on paste.
      event.preventDefault();
      insertComposerClipboardText(editor, text);
      return true;
    },
  },
});
