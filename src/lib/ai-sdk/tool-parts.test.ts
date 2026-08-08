import type { DynamicToolUIPart } from "ai";
import { describe, expect, it } from "vitest";

import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

import {
  getToolPartStatus,
  isVisibleIntermediatePart,
  isVisibleOmPart,
  isVisibleToolPart,
} from "./tool-parts";

const PENDING_STATES = [
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
] as const satisfies DynamicToolUIPart["state"][];

const asPart = (part: { type: string } & Record<string, unknown>): ThreadUIMessagePart =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- visibility only reads `type`.
  part as unknown as ThreadUIMessagePart;

describe("getToolPartStatus", () => {
  it("treats every pre-output state as pending", () => {
    for (const state of PENDING_STATES) {
      expect(getToolPartStatus({ state })).toBe("pending");
    }
  });

  it("treats a completed output as done", () => {
    expect(getToolPartStatus({ state: "output-available" })).toBe("done");
    expect(getToolPartStatus({ state: "output-available", preliminary: false })).toBe("done");
  });

  it("keeps a preliminary output pending so the shimmer stays on", () => {
    expect(getToolPartStatus({ state: "output-available", preliminary: true })).toBe("pending");
  });

  it("ignores preliminary on states that are not output-available", () => {
    expect(getToolPartStatus({ state: "output-error", preliminary: true })).toBe("error");
    expect(getToolPartStatus({ state: "input-available", preliminary: false })).toBe("pending");
  });

  it("maps failed and denied outputs to error", () => {
    expect(getToolPartStatus({ state: "output-error" })).toBe("error");
    expect(getToolPartStatus({ state: "output-denied" })).toBe("error");
  });
});

describe("isVisibleOmPart", () => {
  it("accepts the observation, buffering, and activation parts that render UI", () => {
    const visible = [
      "data-om-observation-start",
      "data-om-observation-end",
      "data-om-observation-failed",
      "data-om-buffering-start",
      "data-om-buffering-end",
      "data-om-buffering-failed",
      "data-om-activation",
    ] as const;

    for (const type of visible) {
      expect(isVisibleOmPart({ type })).toBe(true);
    }
  });

  it("rejects om parts that have no UI, so it is a whitelist and not a prefix check", () => {
    // Mastra also streams these, and OmPart renders nothing for them.
    expect(isVisibleOmPart({ type: "data-om-status" })).toBe(false);
    expect(isVisibleOmPart({ type: "data-om-thread-update" })).toBe(false);
  });
});

describe("isVisibleToolPart", () => {
  it("rejects tool parts with no label so they cannot render a blank indicator", () => {
    expect(isVisibleToolPart(asPart({ type: "tool-somethingNew" }))).toBe(false);
  });

  it("resolves dynamic tools by their toolName rather than the part type", () => {
    expect(isVisibleToolPart(asPart({ type: "dynamic-tool", toolName: "recall" }))).toBe(true);
    expect(isVisibleToolPart(asPart({ type: "dynamic-tool", toolName: "unknown" }))).toBe(false);
  });

  it("rejects om parts without UI and parts that are not tools at all", () => {
    expect(isVisibleToolPart(asPart({ type: "data-om-status" }))).toBe(false);
    expect(isVisibleToolPart(asPart({ type: "step-start" }))).toBe(false);
    expect(isVisibleToolPart(asPart({ type: "file", mediaType: "image/png", url: "u" }))).toBe(
      false,
    );
  });

  it("rejects work-segment timing markers so they stay out of the planning placeholder", () => {
    expect(isVisibleToolPart(asPart({ type: "data-work-start" }))).toBe(false);
    expect(isVisibleToolPart(asPart({ type: "data-work-end" }))).toBe(false);
  });
});

describe("isVisibleIntermediatePart", () => {
  it("includes reasoning and known tools but excludes text", () => {
    expect(isVisibleIntermediatePart(asPart({ type: "reasoning", text: "x", state: "done" }))).toBe(
      true,
    );
    expect(isVisibleIntermediatePart(asPart({ type: "tool-getFile" }))).toBe(true);
    expect(isVisibleIntermediatePart(asPart({ type: "text", text: "hi" }))).toBe(false);
    expect(isVisibleIntermediatePart(asPart({ type: "data-work-start" }))).toBe(false);
  });
});
