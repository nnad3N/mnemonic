import * as v from "valibot";

const MENTION_KEY_TYPE_SEPARATOR = "::";

const mentionTypeSchema = v.picklist([
  "artifact",
  "attachment",
  "selection",
  "thread",
  "topic",
]);

type MentionKeyType = v.InferOutput<typeof mentionTypeSchema>;

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
