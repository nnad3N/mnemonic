import type { PluginConfig } from "platejs";
import { createTPlatePlugin } from "platejs/react";

type ThreadComposerKeyboardConfig = PluginConfig<
  "thread-composer-keyboard",
  {
    onEnter?: () => void | Promise<void>;
    onEscape?: () => void;
    onStopStream?: () => void | Promise<void>;
  }
>;

export const ThreadComposerKeyboardPlugin =
  createTPlatePlugin<ThreadComposerKeyboardConfig>({
    key: "thread-composer-keyboard",
    options: {
      onEnter: undefined,
      onEscape: undefined,
      onStopStream: undefined,
    },
    handlers: {
      onKeyDown: ({ event, getOptions }) => {
        const { onEnter, onEscape, onStopStream } = getOptions();

        if (event.key === "Escape" && onEscape) {
          event.preventDefault();
          onEscape();
          return true;
        }

        if (
          event.key === "Backspace" &&
          (event.metaKey || event.ctrlKey) &&
          event.shiftKey &&
          onStopStream
        ) {
          event.preventDefault();
          void onStopStream();
          return true;
        }

        if (event.key === "Enter" && !event.shiftKey && onEnter) {
          event.preventDefault();
          void onEnter();
          return true;
        }

        return false;
      },
    },
  });
