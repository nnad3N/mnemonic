import type { Value } from "platejs";
import { createPlateEditor } from "platejs/react";

import { threadEditorPlugins } from "@/routes/_protected.chat.$threadId/-thread-components/composer/plate";

/** Headless Plate editor with the thread composer plugins — no React tree. */
export const createComposerEditor = (value?: Value) =>
  createPlateEditor({
    id: "composer-test-editor",
    plugins: threadEditorPlugins,
    value,
  });
