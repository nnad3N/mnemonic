import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ToolUIPart } from "ai";
import { describe, expect, it } from "vitest";

import { render } from "@/test/render-message";

import type { ThreadUITools } from "../-thread-types";
import { ExecuteCodePart } from "./execute-code-part";

type ExecuteCodeToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-executeCode" }>;

const pendingExecuteCode = (code?: string): ExecuteCodeToolPart =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool UI fixture for component render.
  ({
    type: "tool-executeCode",
    toolCallId: "call-1",
    state: "input-available",
    input: code === undefined ? undefined : { code },
  }) as ExecuteCodeToolPart;

const successExecuteCode = (
  code: string,
  output: {
    result?: unknown;
    logs?: string;
  },
): ExecuteCodeToolPart =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool UI fixture for component render.
  ({
    type: "tool-executeCode",
    toolCallId: "call-1",
    state: "output-available",
    input: { code },
    output: { type: "success", ...output },
  }) as ExecuteCodeToolPart;

const errorExecuteCode = (code: string): ExecuteCodeToolPart =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tool UI fixture for component render.
  ({
    type: "tool-executeCode",
    toolCallId: "call-1",
    state: "output-available",
    input: { code },
    output: { type: "error", name: "TypeError", message: "nope" },
  }) as ExecuteCodeToolPart;

describe("ExecuteCodePart", () => {
  it("falls back to the plain tool indicator when there is no code yet", () => {
    render(<ExecuteCodePart part={pendingExecuteCode()} />, { isStreaming: true });

    const label = screen.getByText("Executing code");
    expect(label.closest("div")).toHaveClass("shimmer");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a collapsible trigger and shows code plus success output when expanded", async () => {
    const user = userEvent.setup();
    render(<ExecuteCodePart part={successExecuteCode("1 + 1", { result: 2, logs: "ok" })} />);

    const trigger = screen.getByRole("button", { name: /Executed code/i });
    expect(trigger.tagName).toBe("BUTTON");

    await user.click(trigger);

    expect(screen.getByText("1 + 1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("renders error output details when expanded", async () => {
    const user = userEvent.setup();
    render(<ExecuteCodePart part={errorExecuteCode("bad")} />);

    await user.click(screen.getByRole("button", { name: /Executed code/i }));

    expect(screen.getByText(/TypeError: nope/)).toBeInTheDocument();
  });
});
