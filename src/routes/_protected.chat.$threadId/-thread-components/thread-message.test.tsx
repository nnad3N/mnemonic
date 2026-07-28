import { screen } from "@testing-library/react";
import type { ChatStatus } from "ai";
import { describe, expect, it } from "vitest";

import { render } from "@/test/render-message";

import type { ThreadUIMessage, ThreadUIMessagePart } from "../-thread-types";
import { ThreadMessage } from "./thread-message";

const assistantMessage = (parts: ThreadUIMessagePart[]): ThreadUIMessage => ({
  id: "assistant-1",
  role: "assistant",
  parts,
});

const renderLast = (message: ThreadUIMessage, status: ChatStatus) =>
  render(<ThreadMessage message={message} index={1} messageCount={2} status={status} />);

const PLACEHOLDER = "Planning next moves...";

describe("ThreadMessage", () => {
  it("shows the shimmering placeholder for the last message right after submit", () => {
    renderLast(assistantMessage([]), "submitted");

    const placeholder = screen.getByText(PLACEHOLDER);
    expect(placeholder.closest("div")).toHaveClass("shimmer");
  });

  it("does not show the shimmering placeholder for earlier messages right after submit", () => {
    render(
      <ThreadMessage
        message={assistantMessage([])}
        index={0}
        messageCount={2}
        status="submitted"
      />,
    );

    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("keeps the placeholder while streaming a message that has no visible parts yet", () => {
    // step-start is emitted before any text, so the turn would otherwise be blank.
    renderLast(assistantMessage([{ type: "step-start" }]), "streaming");

    expect(screen.getByText(PLACEHOLDER)).toBeInTheDocument();
  });

  it("drops the placeholder as soon as a visible part arrives", () => {
    renderLast(assistantMessage([{ type: "text", text: "Here is the plan" }]), "streaming");

    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
    expect(screen.getByText("Here is the plan")).toBeInTheDocument();
  });

  it("does not show the placeholder for earlier messages that are still empty", () => {
    render(
      <ThreadMessage
        message={assistantMessage([])}
        index={0}
        messageCount={2}
        status="streaming"
      />,
    );

    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("does not show the placeholder for a finished empty message", () => {
    renderLast(assistantMessage([]), "ready");

    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
  });
});
