import type { DynamicToolUIPart } from "ai";
import { getToolName, isToolUIPart } from "ai";

import { WEB_SEARCH_AGENT_TOOL_NAME } from "@/mastra/agents/consts";
import { isKnownToolName } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

export type ToolPartStatus = "done" | "error" | "pending";

type ToolPartStatusInput = {
  preliminary?: boolean;
  state: DynamicToolUIPart["state"];
};

export type WebSearchAgentToolPart = ToolPartStatusInput;

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

export const isVisibleToolPart = (toolName: string): boolean =>
  isKnownToolName(toolName) || toolName === WEB_SEARCH_AGENT_TOOL_NAME;

export const isWebSearchAgentToolPart = (
  part: ThreadUIMessagePart
): part is ThreadUIMessagePart & WebSearchAgentToolPart => {
  if (part.type === "dynamic-tool") {
    return part.toolName === WEB_SEARCH_AGENT_TOOL_NAME;
  }

  return isToolUIPart(part) && getToolName(part) === WEB_SEARCH_AGENT_TOOL_NAME;
};
