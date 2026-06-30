import type { DynamicToolUIPart } from "ai";

export type ToolPartStatus = "done" | "error" | "pending";

type ToolPartStatusInput = {
  preliminary?: boolean;
  state: DynamicToolUIPart["state"];
};

export const getToolPartStatus = (
  part: ToolPartStatusInput
): ToolPartStatus => {
  switch (part.state) {
    case "output-error":
    case "output-denied": {
      return "error";
    }
    case "output-available": {
      return part.preliminary === true ? "pending" : "done";
    }
    case "input-streaming":
    case "input-available":
    case "approval-requested":
    case "approval-responded": {
      return "pending";
    }
    default: {
      return "pending";
    }
  }
};
