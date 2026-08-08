import { describe, expect, it } from "vitest";

import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

import { closeWorkSegments } from "./close-work-segments";

describe("closeWorkSegments", () => {
  it("appends work-end for an unpaired work-start", () => {
    const startedAt = "2026-01-01T00:00:00.000Z";
    const completedAt = Temporal.Instant.from("2026-01-01T00:00:45.000Z");

    const parts: ThreadUIMessagePart[] = [
      {
        type: "data-work-start",
        data: { segmentId: "seg-1", startedAt },
      },
      { type: "text", text: "mid" },
    ];

    closeWorkSegments(parts, completedAt);

    expect(parts).toEqual([
      {
        type: "data-work-start",
        data: { segmentId: "seg-1", startedAt },
      },
      { type: "text", text: "mid" },
      {
        type: "data-work-end",
        data: {
          segmentId: "seg-1",
          completedAt: completedAt.toString(),
          durationMs: 45_000,
        },
      },
    ]);
  });

  it("leaves already closed segments unchanged", () => {
    const parts: ThreadUIMessagePart[] = [
      {
        type: "data-work-start",
        data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00Z" },
      },
      {
        type: "data-work-end",
        data: { segmentId: "seg-1", completedAt: "2026-01-01T00:00:10Z", durationMs: 10_000 },
      },
    ];
    const lengthBefore = parts.length;

    closeWorkSegments(parts, Temporal.Instant.from("2026-01-01T00:00:45.000Z"));

    expect(parts).toHaveLength(lengthBefore);
    expect(parts).toEqual([
      {
        type: "data-work-start",
        data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00Z" },
      },
      {
        type: "data-work-end",
        data: { segmentId: "seg-1", completedAt: "2026-01-01T00:00:10Z", durationMs: 10_000 },
      },
    ]);
  });

  it("closes multiple unpaired starts in encounter order", () => {
    const startedAt = "2026-01-01T00:00:00.000Z";
    const completedAt = Temporal.Instant.from("2026-01-01T00:00:30.000Z");

    const parts: ThreadUIMessagePart[] = [
      {
        type: "data-work-start",
        data: { segmentId: "a", startedAt },
      },
      {
        type: "data-work-start",
        data: { segmentId: "b", startedAt },
      },
      {
        type: "data-work-end",
        data: { segmentId: "a", completedAt: "2026-01-01T00:00:05Z", durationMs: 5_000 },
      },
    ];

    closeWorkSegments(parts, completedAt);

    expect(parts.at(-1)).toEqual({
      type: "data-work-end",
      data: {
        segmentId: "b",
        completedAt: completedAt.toString(),
        durationMs: 30_000,
      },
    });
    expect(parts).toHaveLength(4);
  });
});
