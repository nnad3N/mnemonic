import { describe, expect, it } from "vitest";

import { getMentionKey, parseMentionKey, toMentionUrl } from "./mention-key";

describe("parseMentionKey", () => {
  const key = getMentionKey({ type: "note", value: "gsvEZlkTFRmSaOFO3PJ2u" });

  it("reads the bare key and its url form alike", () => {
    expect(parseMentionKey(key)).toEqual({ type: "note", value: "gsvEZlkTFRmSaOFO3PJ2u" });
    expect(parseMentionKey(toMentionUrl(key))).toEqual(parseMentionKey(key));
    expect(parseMentionKey("mention:note%3A%3AgsvEZlkTFRmSaOFO3PJ2u")).toEqual(
      parseMentionKey(key),
    );
  });

  it("keeps an unencoded url form that is not valid percent-encoding", () => {
    expect(parseMentionKey("mention:selection::100% done")).toEqual({
      type: "selection",
      value: "100% done",
    });
  });

  it("marks anything else unknown", () => {
    expect(parseMentionKey("https://example.com")).toEqual({
      type: "unknown",
      value: "https://example.com",
    });
    expect(parseMentionKey(42)).toEqual({ type: "unknown", value: "" });
  });
});
