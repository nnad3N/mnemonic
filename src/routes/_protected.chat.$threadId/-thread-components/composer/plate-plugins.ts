import type { PluginConfig } from "platejs";
import { createTPlatePlugin } from "platejs/react";
import * as v from "valibot";

const mentionTypeSchema = v.picklist([
  "artifact",
  "attachment",
  "selection",
  "thread",
  "topic",
]);

type MentionKeyType = v.InferOutput<typeof mentionTypeSchema>;

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
  type: MentionKeyType;
};

export type ParseMentionKeyResult = {
  type: MentionKeyType | "unknown";
  value: string;
};

export const parseMentionKey = (key: unknown): ParseMentionKeyResult => {
  if (typeof key !== "string") {
    return { type: "unknown", value: "" };
  }

  const [type, value] = key.split(MENTION_KEY_TYPE_SEPARATOR);

  const parsedType = v.safeParse(mentionTypeSchema, type);

  if (!parsedType.success) {
    return { type: "unknown", value: key };
  }

  return { type: parsedType.output, value };
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
