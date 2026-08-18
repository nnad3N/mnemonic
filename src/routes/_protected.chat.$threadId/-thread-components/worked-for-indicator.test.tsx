import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types.server";
import { render } from "@/test/render-message";

import type { ThreadUIMessagePart } from "../-thread-types";
import { WorkedForIndicator } from "./worked-for-indicator";

const toolPart = (toolName: MnemonicToolName, toolCallId: string): ThreadUIMessagePart =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool UI fixture for component render.
  ({
    type: `tool-${toolName}`,
    toolCallId,
    state: "output-available",
    input: {},
    output: {},
  }) as ThreadUIMessagePart;

const tickerRow = (container: HTMLElement): HTMLElement => {
  const row = container.querySelector<HTMLElement>('[data-test-id="work-ticker-current"]');
  assert(row, "Expected the work ticker row");

  return row;
};

const STARTED_AT = "2026-01-01T00:00:00Z";

const indicator = (parts: ThreadUIMessagePart[], endedAt?: string) => (
  <WorkedForIndicator parts={parts} timing={{ startedAt: STARTED_AT, endedAt }} />
);

const renderIndicator = (parts: ThreadUIMessagePart[]) =>
  render(indicator(parts), { isStreaming: true });

describe("WorkedForIndicator ticker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const settle = (row: HTMLElement) => {
    fireEvent.animationEnd(row);
    act(() => {
      vi.advanceTimersByTime(700);
    });
  };

  it("holds the current part through the animation and hold time, then jumps to the latest", () => {
    const initial = [toolPart("recall", "c1")];
    const { container, rerender } = renderIndicator(initial);

    const grown = [...initial, toolPart("calculate", "c2"), toolPart("fileVectorSearch", "c3")];
    rerender(indicator(grown));

    expect(screen.getByText("Recalled memories")).toBeInTheDocument();
    expect(screen.queryByText("Calculated")).not.toBeInTheDocument();
    expect(screen.queryByText("Searched files")).not.toBeInTheDocument();

    fireEvent.animationEnd(tickerRow(container));
    act(() => {
      vi.advanceTimersByTime(699);
    });

    expect(screen.queryByText("Searched files")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByText("Searched files")).toBeInTheDocument();
    expect(screen.queryByText("Calculated")).not.toBeInTheDocument();
    expect(screen.getByText("Recalled memories")).toBeInTheDocument();

    settle(tickerRow(container));

    expect(screen.queryByText("Recalled memories")).not.toBeInTheDocument();
  });

  it("drops the animation classes and the exiting row once the handover has played", () => {
    const initial = [toolPart("recall", "c1")];
    const { container } = renderIndicator(initial);

    expect(tickerRow(container)).toHaveClass("animate-in");

    fireEvent.animationEnd(tickerRow(container));

    expect(tickerRow(container)).not.toHaveClass("animate-in");
  });

  it("advances immediately when a part arrives after the hold has elapsed", () => {
    const initial = [toolPart("recall", "c1")];
    const { container, rerender } = renderIndicator(initial);

    settle(tickerRow(container));

    const grown = [...initial, toolPart("calculate", "c2")];
    rerender(indicator(grown));

    expect(screen.getByText("Calculated")).toBeInTheDocument();
  });

  it("ignores animation ends bubbling from inside the row", () => {
    const initial = [toolPart("recall", "c1")];
    const { rerender } = renderIndicator(initial);

    settle(screen.getByText("Recalled memories"));

    const grown = [...initial, toolPart("calculate", "c2")];
    rerender(indicator(grown));

    expect(screen.queryByText("Calculated")).not.toBeInTheDocument();
  });

  it("collapses immediately when the work run ends, keeping the row mounted for the exit", () => {
    const initial = [toolPart("recall", "c1")];
    const { container, rerender } = renderIndicator(initial);

    rerender(indicator(initial, "2026-01-01T00:00:05Z"));

    expect(screen.getByText("Recalled memories")).toBeInTheDocument();
    expect(tickerRow(container).closest(".grid")).toHaveClass("grid-rows-[0fr]");
  });

  it("renders no ticker for a finished message", () => {
    const parts = [toolPart("recall", "c1")];
    render(indicator(parts, "2026-01-01T00:00:05Z"));

    expect(screen.queryByText("Recalled memories")).not.toBeInTheDocument();
    expect(screen.getByText("Worked for 5s")).toBeInTheDocument();
  });
});
