import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types";
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

const workStart: ThreadUIMessagePart = {
  type: "data-work-start",
  data: { segmentId: "seg-1", startedAt: "2026-01-01T00:00:00Z" },
};

const workEnd: ThreadUIMessagePart = {
  type: "data-work-end",
  data: { segmentId: "seg-1", completedAt: "2026-01-01T00:00:05Z", durationMs: 5000 },
};

const tickerRow = (container: HTMLElement): HTMLElement => {
  const row = container.querySelector<HTMLElement>('[data-test-id="work-ticker-current"]');
  if (!row) {
    throw new Error("Expected the work ticker row");
  }

  return row;
};

const renderIndicator = (parts: ThreadUIMessagePart[]) =>
  render(<WorkedForIndicator messageParts={parts} parts={parts} />, { isStreaming: true });

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
    const initial = [workStart, toolPart("recall", "c1")];
    const { container, rerender } = renderIndicator(initial);

    const grown = [...initial, toolPart("getFile", "c2"), toolPart("fileVectorSearch", "c3")];
    rerender(<WorkedForIndicator messageParts={grown} parts={grown} />);

    expect(screen.getByText("Recalled memories")).toBeInTheDocument();
    expect(screen.queryByText("Read file")).not.toBeInTheDocument();
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
    expect(screen.queryByText("Read file")).not.toBeInTheDocument();
    expect(screen.getByText("Recalled memories")).toBeInTheDocument();
  });

  it("advances immediately when a part arrives after the hold has elapsed", () => {
    const initial = [workStart, toolPart("recall", "c1")];
    const { container, rerender } = renderIndicator(initial);

    settle(tickerRow(container));

    const grown = [...initial, toolPart("getFile", "c2")];
    rerender(<WorkedForIndicator messageParts={grown} parts={grown} />);

    expect(screen.getByText("Read file")).toBeInTheDocument();
  });

  it("ignores animation ends bubbling from inside the row", () => {
    const initial = [workStart, toolPart("recall", "c1")];
    const { rerender } = renderIndicator(initial);

    settle(screen.getByText("Recalled memories"));

    const grown = [...initial, toolPart("getFile", "c2")];
    rerender(<WorkedForIndicator messageParts={grown} parts={grown} />);

    expect(screen.queryByText("Read file")).not.toBeInTheDocument();
  });

  it("collapses immediately when the work run ends, keeping the row mounted for the exit", () => {
    const initial = [workStart, toolPart("recall", "c1")];
    const { container, rerender } = renderIndicator(initial);

    const ended = [...initial, workEnd];
    rerender(<WorkedForIndicator messageParts={ended} parts={ended} />);

    expect(screen.getByText("Recalled memories")).toBeInTheDocument();
    expect(tickerRow(container).closest(".grid")).toHaveClass("grid-rows-[0fr]");
  });

  it("renders no ticker for a finished message", () => {
    const parts = [workStart, toolPart("recall", "c1"), workEnd];
    render(<WorkedForIndicator messageParts={parts} parts={parts} />);

    expect(screen.queryByText("Recalled memories")).not.toBeInTheDocument();
  });
});
