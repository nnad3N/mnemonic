import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { render } from "@/test/render-message";

import type { ThreadUIMessagePart } from "../-thread-types";
import { OmPart } from "./om-part";

type OmPartType = Extract<
  ThreadUIMessagePart,
  {
    type:
      | "data-om-observation-start"
      | "data-om-observation-end"
      | "data-om-observation-failed"
      | "data-om-buffering-start"
      | "data-om-buffering-end"
      | "data-om-buffering-failed"
      | "data-om-activation";
  }
>["type"];

/** Component only reads `type`, `data.cycleId`, `data.operationType`, and `data.observations`. */
const omPart = (
  type: OmPartType,
  data: {
    cycleId: string;
    operationType?: "observation" | "reflection";
    observations?: string;
  },
): Extract<ThreadUIMessagePart, { type: OmPartType }> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- UI fixture; OmPart ignores unused OM fields.
  ({ type, data }) as Extract<ThreadUIMessagePart, { type: OmPartType }>;

describe("OmPart", () => {
  it("shows a pending observation indicator while the cycle is open", () => {
    const part = omPart("data-om-observation-start", {
      cycleId: "cycle-1",
      operationType: "observation",
    });

    render(<OmPart messageParts={[part]} part={part} />, { isStreaming: true });

    const indicator = screen.getByText("Observing conversation");
    expect(indicator.closest("div")).toHaveClass("shimmer");
  });

  it("hides the start indicator once the cycle has completed", () => {
    const start = omPart("data-om-observation-start", {
      cycleId: "cycle-1",
      operationType: "observation",
    });
    const end = omPart("data-om-observation-end", {
      cycleId: "cycle-1",
      operationType: "observation",
      observations: "summary",
    });

    const { container } = render(<OmPart messageParts={[start, end]} part={start} />, {
      isStreaming: true,
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a start indicator when only a different cycle has completed", () => {
    const start = omPart("data-om-observation-start", {
      cycleId: "cycle-1",
      operationType: "observation",
    });
    const otherEnd = omPart("data-om-buffering-failed", {
      cycleId: "other",
      operationType: "observation",
    });

    render(<OmPart messageParts={[start, otherEnd]} part={start} />);

    expect(screen.getByText("Observing conversation")).toBeInTheDocument();
  });

  it("renders reflection pending copy for reflection observations", () => {
    const part = omPart("data-om-observation-start", {
      cycleId: "cycle-1",
      operationType: "reflection",
    });

    render(<OmPart messageParts={[part]} part={part} />);

    expect(screen.getByText("Reflecting on memories")).toBeInTheDocument();
  });

  it("renders a successful observation with collapsible observations text", async () => {
    const user = userEvent.setup();
    const part = omPart("data-om-observation-end", {
      cycleId: "cycle-1",
      operationType: "observation",
      observations: "Noted the user's preference",
    });

    render(<OmPart messageParts={[part]} part={part} />);

    const trigger = screen.getByRole("button", { name: /Observed conversation/i });
    await user.click(trigger);

    expect(screen.getByText("Noted the user's preference")).toBeInTheDocument();
  });

  it("renders buffering success copy", () => {
    const part = omPart("data-om-buffering-end", {
      cycleId: "cycle-1",
      operationType: "observation",
    });

    render(<OmPart messageParts={[part]} part={part} />);

    expect(screen.getByText("Prepared observations")).toBeInTheDocument();
  });

  it("renders activation success as a collapsible button when observations exist", () => {
    const part = omPart("data-om-activation", { cycleId: "cycle-1", observations: "activated" });

    render(<OmPart messageParts={[part]} part={part} />);

    expect(screen.getByRole("button", { name: /Updated memory/i })).toBeInTheDocument();
  });

  it("renders observation failures as destructive indicators without shimmer", () => {
    const part = omPart("data-om-observation-failed", {
      cycleId: "cycle-1",
      operationType: "observation",
    });

    render(<OmPart messageParts={[part]} part={part} />, { isStreaming: true });

    const indicator = screen.getByText("Could not observe conversation");
    expect(indicator.closest("div")).toHaveClass("text-destructive");
    expect(indicator.closest("div")).not.toHaveClass("shimmer");
  });
});
