import type { PluginConfig } from "platejs";
import { createTPlatePlugin } from "platejs/react";

type MentionKeyType = "artifact" | "selection";

const MENTION_KEY_TYPE_SEPARATOR = "::";

export type MentionKey =
  `${MentionKeyType}${typeof MENTION_KEY_TYPE_SEPARATOR}${string}`;

export const getMentionKey = (value: {
  type: MentionKeyType;
  value: string;
}): MentionKey => `${value.type}${MENTION_KEY_TYPE_SEPARATOR}${value.value}`;

export type MentionValue = {
  key: MentionKey;
  text: string;
};

export const parseMentionKey = (
  key: unknown
): { type: MentionKeyType | "unknown"; value: string } => {
  if (typeof key !== "string") {
    return { type: "unknown", value: "" };
  }

  const [type, value] = key.split(MENTION_KEY_TYPE_SEPARATOR);

  if (type !== "artifact" && type !== "selection") {
    return { type: "unknown", value: key };
  }

  return { type: type as MentionKeyType, value };
};

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
