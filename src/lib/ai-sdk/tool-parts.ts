import type { DynamicToolUIPart } from "ai";
import { getToolName, isToolUIPart } from "ai";

import { isKnownToolName } from "@/lib/ai-sdk/tool-labels";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

export type ToolPartStatus = "done" | "error" | "pending";

type ToolPartStatusInput = {
  preliminary?: boolean;
  state: DynamicToolUIPart["state"];
};

export const getToolPartStatus = (part: ToolPartStatusInput): ToolPartStatus => {
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

export const isVisibleOmPart = (part: Pick<ThreadUIMessagePart, "type">): boolean => {
  // oxlint-disable-next-line typescript/switch-exhaustiveness-check
  switch (part.type) {
    case "data-om-observation-start":
    case "data-om-observation-end":
    case "data-om-observation-failed":
    case "data-om-buffering-start":
    case "data-om-buffering-end":
    case "data-om-buffering-failed":
    case "data-om-activation": {
      return true;
    }
    default: {
      return false;
    }
  }
};

export const isVisibleToolPart = (part: ThreadUIMessagePart): boolean => {
  if (part.type === "data-work-start" || part.type === "data-work-end") {
    return false;
  }

  if (part.type === "reasoning" || part.type === "text") {
    return true;
  }

  if (isVisibleOmPart(part)) {
    return true;
  }

  if (!isToolUIPart(part)) {
    return false;
  }

  return isKnownToolName(getToolName(part));
};

export const isVisibleIntermediatePart = (part: ThreadUIMessagePart): boolean =>
  part.type !== "text" && isVisibleToolPart(part);
