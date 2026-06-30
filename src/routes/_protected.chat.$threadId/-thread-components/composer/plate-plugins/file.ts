import type { PluginConfig } from "platejs";
import { createTPlatePlugin } from "platejs/react";

type ThreadComposerFileConfig = PluginConfig<
  "thread-composer-file",
  {
    onUploadFiles?: (files: File[]) => void | Promise<void>;
  }
>;

export const ThreadComposerFilePlugin =
  createTPlatePlugin<ThreadComposerFileConfig>({
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

        const files = event.clipboardData?.files;

        if (!files?.length) {
          return false;
        }

        event.preventDefault();
        void onUploadFiles([...files]);
        return true;
      },
    },
  });
