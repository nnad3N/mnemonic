import { describe, expect, it } from "vitest";

import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

import { mergeConsecutiveAssistantMessages } from "./get-thread";

const message = ({
  id,
  role,
  parts,
  metadata,
}: {
  id: string;
  role: ThreadUIMessage["role"];
  parts?: ThreadUIMessage["parts"];
  metadata?: ThreadUIMessage["metadata"];
}): ThreadUIMessage => ({
  id,
  role,
  parts: parts ?? [{ type: "text", text: id }],
  metadata,
});

describe("mergeConsecutiveAssistantMessages", () => {
  it("leaves a single assistant unchanged", () => {
    const messages = [
      message({ id: "u1", role: "user" }),
      message({ id: "a1", role: "assistant" }),
    ];

    expect(mergeConsecutiveAssistantMessages(messages)).toEqual(messages);
  });

  it("merges consecutive assistants after a user, keeping last id and concatenating parts", () => {
    const firstParts: ThreadUIMessage["parts"] = [
      { type: "text", text: "first" },
      {
        type: "data-work-start",
        data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00.000Z" },
      },
    ];
    const secondParts: ThreadUIMessage["parts"] = [
      { type: "text", text: "second" },
      {
        type: "data-work-end",
        data: {
          segmentId: "seg-1",
          completedAt: "2026-01-01T00:01:00.000Z",
          durationMs: 60_000,
        },
      },
    ];
    const messages = [
      message({ id: "u1", role: "user" }),
      message({ id: "a1", role: "assistant", parts: firstParts, metadata: { attachments: [] } }),
      message({ id: "a2", role: "assistant", parts: secondParts }),
    ];

    expect(mergeConsecutiveAssistantMessages(messages)).toEqual([
      message({ id: "u1", role: "user" }),
      {
        id: "a2",
        role: "assistant",
        parts: firstParts.concat(secondParts),
      },
    ]);
  });

  it("does not merge assistants separated by a user", () => {
    const messages = [
      message({ id: "u1", role: "user" }),
      message({ id: "a1", role: "assistant" }),
      message({ id: "u2", role: "user" }),
      message({ id: "a2", role: "assistant" }),
    ];

    expect(mergeConsecutiveAssistantMessages(messages)).toEqual(messages);
  });

  it("merges more than two consecutive assistants", () => {
    const messages = [
      message({ id: "u1", role: "user" }),
      message({ id: "a1", role: "assistant", parts: [{ type: "text", text: "one" }] }),
      message({ id: "a2", role: "assistant", parts: [{ type: "text", text: "two" }] }),
      message({ id: "a3", role: "assistant", parts: [{ type: "text", text: "three" }] }),
    ];

    expect(mergeConsecutiveAssistantMessages(messages)).toEqual([
      message({ id: "u1", role: "user" }),
      {
        id: "a3",
        role: "assistant",
        parts: [
          { type: "text", text: "one" },
          { type: "text", text: "two" },
          { type: "text", text: "three" },
        ],
      },
    ]);
  });

  it("returns an empty list unchanged", () => {
    expect(mergeConsecutiveAssistantMessages([])).toEqual([]);
  });
});
