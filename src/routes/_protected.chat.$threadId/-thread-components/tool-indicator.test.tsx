import { screen } from "@testing-library/react";
import type { ToolUIPart } from "ai";
import { describe, expect, it } from "vitest";

import { render } from "@/test/render-message";

import type { ThreadUITools } from "../-thread-types";
import { AssistantToolPart } from "./assistant-tool-part";
import { ToolIndicator } from "./tool-indicator";
import { TOOL_LABELS } from "./tool-labels";

type RecallToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-recall" }>;

const recallPart = (state: RecallToolPart["state"]): RecallToolPart =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool UI fixture for component render.
  ({
    type: "tool-recall",
    toolCallId: "call-1",
    state,
    input: state === "input-streaming" ? undefined : { query: "prefs" },
  }) as RecallToolPart;

const recallDonePart = (): RecallToolPart =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool UI fixture for component render.
  ({
    type: "tool-recall",
    toolCallId: "call-1",
    state: "output-available",
    input: { query: "prefs" },
    output: { memories: [] },
  }) as RecallToolPart;

describe("ToolIndicator", () => {
  it("applies shimmer only while pending and the message is streaming", () => {
    render(<ToolIndicator pending>Label</ToolIndicator>, { isStreaming: true });
    expect(screen.getByText("Label")).toHaveClass("shimmer");
  });

  it("does not shimmer when pending but the message is not streaming", () => {
    render(<ToolIndicator pending>Label</ToolIndicator>);

    expect(screen.getByText("Label")).not.toHaveClass("shimmer");
  });

  it("does not shimmer when streaming but not pending", () => {
    render(<ToolIndicator pending={false}>Label</ToolIndicator>, { isStreaming: true });

    expect(screen.getByText("Label")).not.toHaveClass("shimmer");
  });

  it("renders a div by default and a button when interactive", () => {
    const { rerender } = render(<ToolIndicator>Static</ToolIndicator>);
    expect(screen.getByText("Static").tagName).toBe("DIV");

    rerender(<ToolIndicator interactive="collapsible">Open</ToolIndicator>);
    expect(screen.getByRole("button", { name: "Open" }).tagName).toBe("BUTTON");
  });

  it("renders interactive=button as a div while pending and as a button when done", () => {
    const { rerender } = render(
      <ToolIndicator interactive="button" pending>
        Pending action
      </ToolIndicator>,
    );
    expect(screen.getByText("Pending action").tagName).toBe("DIV");

    rerender(
      <ToolIndicator interactive="button" pending={false}>
        Done action
      </ToolIndicator>,
    );
    expect(screen.getByRole("button", { name: "Done action" }).tagName).toBe("BUTTON");
  });
});

const toolPart = (toolName: keyof typeof TOOL_LABELS, state: ToolUIPart["state"]) =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool UI fixture for component render.
  ({
    type: `tool-${toolName}`,
    toolCallId: "call-1",
    state,
    input: {},
    output: state === "output-available" ? {} : undefined,
  }) as ToolUIPart<ThreadUITools>;

const unknownToolPart = () =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a tool name the UI has no label for.
  ({
    type: "tool-somethingNew",
    toolCallId: "call-1",
    state: "output-available",
    input: {},
    output: {},
  }) as unknown as ToolUIPart<ThreadUITools>;

const TOOL_NAMES = [
  "executeCode",
  "fileGraphRag",
  "fileVectorSearch",
  "getFileFromS3",
  "recall",
  "webFetch",
  "webSearch",
] as const satisfies (keyof typeof TOOL_LABELS)[];

describe("AssistantToolPart", () => {
  it("covers every tool the UI knows about", () => {
    expect(TOOL_NAMES).toHaveLength(Object.keys(TOOL_LABELS).length);
  });

  it("renders the label every known tool declares for each status", () => {
    // renderToolLabel duplicates the copy in TOOL_LABELS; this keeps them aligned.
    for (const toolName of TOOL_NAMES) {
      const labels = TOOL_LABELS[toolName];
      const { unmount } = render(
        <>
          <AssistantToolPart part={toolPart(toolName, "input-streaming")} />
          <AssistantToolPart part={toolPart(toolName, "output-available")} />
          <AssistantToolPart part={toolPart(toolName, "output-error")} />
        </>,
      );

      expect(screen.getByText(labels.pending)).toBeInTheDocument();
      expect(screen.getByText(labels.done)).toBeInTheDocument();
      expect(screen.getByText(labels.error)).toBeInTheDocument();

      unmount();
    }
  });

  it("marks only the error status as destructive", () => {
    render(<AssistantToolPart part={toolPart("webSearch", "output-error")} />);

    const label = screen.getByText(TOOL_LABELS.webSearch.error);
    expect(label.closest("div")).toHaveClass("text-destructive");
  });

  it("renders nothing for a tool the UI has no label for", () => {
    const { container } = render(<AssistantToolPart part={unknownToolPart()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows pending recall copy with shimmer while streaming", () => {
    render(<AssistantToolPart part={recallPart("input-streaming")} />, { isStreaming: true });

    const label = screen.getByText("Recalling memories");
    expect(label.closest("div")).toHaveClass("shimmer");
    expect(label.closest("div")?.tagName).toBe("DIV");
  });

  it("shows done recall copy without shimmer after output", () => {
    render(<AssistantToolPart part={recallDonePart()} />, { isStreaming: true });

    const label = screen.getByText("Recalled memories");
    expect(label.closest("div")).not.toHaveClass("shimmer");
  });
});
