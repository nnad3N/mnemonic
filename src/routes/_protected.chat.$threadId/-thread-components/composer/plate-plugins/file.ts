import { nanoid } from "nanoid";
import type { PluginConfig } from "platejs";
import { createTPlatePlugin } from "platejs/react";

type ThreadComposerFileConfig = PluginConfig<
  "thread-composer-file",
  {
    onUploadFiles?: (files: File[]) => void | Promise<void>;
  }
>;

/** Browsers label clipboard images `image.png` (and similar); append a short id so names stay unique. */
export const withUniqueClipboardImageName = (file: File): File => {
  const parts = file.name.split(".");
  const extension = parts.pop();
  const id = nanoid(4);

  const name =
    extension && parts.length > 0 ? `${parts.join(".")}-${id}.${extension}` : `${file.name}-${id}`;

  return new File([file], name, {
    type: file.type,
    lastModified: file.lastModified,
  });
};

export const ThreadComposerFilePlugin = createTPlatePlugin<ThreadComposerFileConfig>({
  key: "thread-composer-file",
  options: {
    onUploadFiles: undefined,
  },
  handlers: {
    onPaste: ({ event, getOptions }) => {
      const { onUploadFiles } = getOptions();

      if (!onUploadFiles) {
        return false;
      }

      const files = event.clipboardData.files;

      if (files.length === 0) {
        return false;
      }

      event.preventDefault();

      const uniqueFiles: File[] = [];
      for (const file of files) {
        uniqueFiles.push(withUniqueClipboardImageName(file));
      }

      void onUploadFiles(uniqueFiles);
      return true;
    },
  },
});
