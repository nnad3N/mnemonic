import type { PluginConfig } from "platejs";
import { createTPlatePlugin } from "platejs/react";

import { insertComposerLink, parseComposerLinkPasteSegments } from "./link";

type ThreadComposerPasteConfig = PluginConfig<"thread-composer-paste">;

export const ThreadComposerPastePlugin =
  createTPlatePlugin<ThreadComposerPasteConfig>({
    key: "thread-composer-paste",
    handlers: {
      onPaste: ({ editor, event }) => {
        const text = event.clipboardData?.getData("text/plain");

        const segments = parseComposerLinkPasteSegments(text);

        if (!segments) {
          return false;
        }

        event.preventDefault();

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

        return true;
      },
    },
  });
