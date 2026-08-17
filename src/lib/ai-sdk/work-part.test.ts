import { describe, expect, it } from "vitest";

import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types.server";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

import { getDominantWorkActivityKind, groupAssistantParts } from "./work-part";

const toolPart = (toolName: MnemonicToolName, toolCallId?: string): ThreadUIMessagePart => ({
  type: `tool-${toolName}`,
  toolCallId: toolCallId ?? `${toolName}-1`,
  state: "output-available",
  // @ts-expect-error -- test helper only needs tool parts.
  input: {},
  output: {},
});

describe("groupAssistantParts", () => {
  it("groups intermediates before text into one run", () => {
    const parts: ThreadUIMessagePart[] = [
      { type: "reasoning", text: "thinking", state: "done" },
      toolPart("getFile"),
      {
        type: "data-om-observation-end",
        data: {
          cycleId: "c1",
          recordId: "record-1",
          operationType: "observation",
          completedAt: "2026-01-01T00:00:01Z",
          durationMs: 1000,
          tokensObserved: 1000,
          observationTokens: 1000,
          threadId: "thread-1",
        },
      },
      { type: "text", text: "answer" },
    ];

    const blocks = groupAssistantParts(parts);

    expect(blocks).toHaveLength(2);
    expect(blocks.at(0)).toMatchObject({
      type: "run",
      id: "run-0",
      parts: parts.slice(0, 3),
      startIndex: 0,
    });
    expect(blocks.at(1)).toMatchObject({
      type: "text",
      id: "text-3",
      index: 3,
    });
  });

  it("splits runs across text boundaries", () => {
    const parts: ThreadUIMessagePart[] = [
      toolPart("getFile"),
      { type: "text", text: "mid" },
      toolPart("webSearch"),
      toolPart("webFetch"),
      { type: "text", text: "end" },
    ];

    expect(groupAssistantParts(parts)).toEqual([
      {
        type: "run",
        id: "run-0",
        parts: [parts.at(0)],
        startIndex: 0,
      },
      {
        type: "text",
        id: "text-1",
        part: parts.at(1),
        index: 1,
      },
      {
        type: "run",
        id: "run-2",
        parts: [parts.at(2), parts.at(3)],
        startIndex: 2,
      },
      {
        type: "text",
        id: "text-4",
        part: parts.at(4),
        index: 4,
      },
    ]);
  });

  it("omits runs with no visible intermediates", () => {
    const parts: ThreadUIMessagePart[] = [
      { type: "step-start" },
      { type: "text", text: "only text" },
    ];

    expect(groupAssistantParts(parts)).toEqual([
      {
        type: "text",
        id: "text-1",
        part: parts.at(1),
        index: 1,
      },
    ]);
  });
});

describe("getDominantWorkActivityKind", () => {
  it("returns default when there are no tool parts", () => {
    expect(
      getDominantWorkActivityKind([{ type: "reasoning", text: "thinking", state: "done" }]),
    ).toBe("default");
  });

  it("returns research when research tools have a strict majority", () => {
    expect(
      getDominantWorkActivityKind([
        toolPart("webSearch", "c1"),
        toolPart("webFetch", "c2"),
        toolPart("getFile", "c3"),
      ]),
    ).toBe("research");
  });

  it("returns default on a tie", () => {
    expect(
      getDominantWorkActivityKind([toolPart("webSearch", "c1"), toolPart("getFile", "c2")]),
    ).toBe("default");
  });
});
