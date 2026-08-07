import { describe, expect, it } from "vitest";

import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

import { getDominantWorkActivityKind, getWorkRunTiming, groupAssistantParts } from "./work-part";

const toolPart = (toolName: MnemonicToolName, toolCallId?: string): ThreadUIMessagePart => ({
  type: `tool-${toolName}`,
  toolCallId: toolCallId ?? `${toolName}-1`,
  state: "output-available",
  // @ts-expect-error -- test helper only needs tool parts.
  input: {},
  output: {},
});

describe("getWorkRunTiming", () => {
  it("reads start and end markers from a run", () => {
    const parts: ThreadUIMessagePart[] = [
      {
        type: "data-work-start",
        data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00Z" },
      },
      toolPart("getFile"),
      {
        type: "data-work-end",
        data: { segmentId: "seg-1", completedAt: "2026-01-01T00:01:20Z", durationMs: 80_000 },
      },
    ];

    expect(getWorkRunTiming(parts)).toEqual({
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-01T00:01:20Z",
      durationMs: 80_000,
    });
  });
});

describe("groupAssistantParts", () => {
  it("keeps short runs as a single run block with the visible count", () => {
    const parts: ThreadUIMessagePart[] = [
      toolPart("getFile"),
      toolPart("webSearch"),
      { type: "text", text: "done" },
    ];

    expect(groupAssistantParts(parts)).toEqual([
      {
        type: "run",
        id: "run-0",
        parts: [parts.at(0), parts.at(1)],
        visibleCount: 2,
        startIndex: 0,
      },
      {
        type: "text",
        id: "text-2",
        part: parts.at(2),
        index: 2,
      },
    ]);
  });

  it("groups three or more intermediates before text into one run", () => {
    const parts: ThreadUIMessagePart[] = [
      {
        type: "data-work-start",
        data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00Z" },
      },
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
      {
        type: "data-work-end",
        data: { segmentId: "seg-1", completedAt: "2026-01-01T00:00:10Z", durationMs: 10_000 },
      },
      { type: "text", text: "answer" },
    ];

    const blocks = groupAssistantParts(parts);

    expect(blocks).toHaveLength(2);
    expect(blocks.at(0)).toMatchObject({
      type: "run",
      id: "run-0",
      visibleCount: 3,
      startIndex: 0,
    });
    expect(blocks.at(1)).toMatchObject({
      type: "text",
      id: "text-5",
      index: 5,
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
        visibleCount: 1,
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
        visibleCount: 2,
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

  it("omits marker-only runs with no visible intermediates", () => {
    const parts: ThreadUIMessagePart[] = [
      {
        type: "data-work-start",
        data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00Z" },
      },
      {
        type: "data-work-end",
        data: { segmentId: "seg-1", completedAt: "2026-01-01T00:00:01Z", durationMs: 1000 },
      },
      { type: "text", text: "only text" },
    ];

    expect(groupAssistantParts(parts)).toEqual([
      {
        type: "text",
        id: "text-2",
        part: parts.at(2),
        index: 2,
      },
    ]);
  });
});

describe("getDominantWorkActivityKind", () => {
  it("returns default when there are no tool parts", () => {
    expect(
      getDominantWorkActivityKind([
        { type: "reasoning", text: "thinking", state: "done" },
        {
          type: "data-work-start",
          data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00.000Z" },
        },
      ]),
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

  it("returns default when default tools have a majority", () => {
    expect(
      getDominantWorkActivityKind([
        toolPart("getFile", "c1"),
        toolPart("getFile", "c2"),
        toolPart("getFile", "c3"),
        toolPart("webSearch", "c4"),
      ]),
    ).toBe("default");
  });

  it("treats file search tools as research", () => {
    expect(
      getDominantWorkActivityKind([
        toolPart("fileVectorSearch", "c1"),
        toolPart("fileGraphRag", "c2"),
        toolPart("executeCode", "c3"),
      ]),
    ).toBe("research");
  });
});
