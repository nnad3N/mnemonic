import * as v from "valibot";

const MENTION_KEY_TYPE_SEPARATOR = "::";
const MENTION_URL_PREFIX = "mention:";

const mentionTypeSchema = v.picklist([
  "file",
  "attachment",
  "note",
  "selection",
  "thread",
  "topic",
]);

type MentionKeyType = v.InferOutput<typeof mentionTypeSchema>;

export const mentionKeyFormat = (types: MentionKeyType[]): string =>
  types.map((type) => `"${type}${MENTION_KEY_TYPE_SEPARATOR}<value>"`).join(" or ");

export type MentionKey = `${MentionKeyType}${typeof MENTION_KEY_TYPE_SEPARATOR}${string}`;

export const getMentionKey = (value: { type: MentionKeyType; value: string }): MentionKey =>
  `${value.type}${MENTION_KEY_TYPE_SEPARATOR}${value.value}`;

/** Markdown link form of a key, `[label](mention:note::<id>)`, as the composer emits and the model echoes it. */
export const toMentionUrl = (key: string): string => `${MENTION_URL_PREFIX}${key}`;

export type MentionValue = {
  key: MentionKey;
  text: string;
  type: MentionKeyType;
};

export type ParseMentionKeyResult = {
  type: MentionKeyType | "unknown";
  value: string;
};

const decodeMentionUrl = (url: string): string => {
  const encoded = url.slice(MENTION_URL_PREFIX.length);

  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters
export const parseMentionKey = (key: unknown): ParseMentionKeyResult => {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  if (typeof key !== "string") {
    return { type: "unknown", value: "" };
  }

  const raw = key.startsWith(MENTION_URL_PREFIX) ? decodeMentionUrl(key) : key;

  const [type, value] = raw.split(MENTION_KEY_TYPE_SEPARATOR);

  const parsedType = v.safeParse(mentionTypeSchema, type);

  if (!parsedType.success) {
    return { type: "unknown", value: key };
  }

  return { type: parsedType.output, value };
};
