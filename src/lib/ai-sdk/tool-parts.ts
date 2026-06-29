import type { DynamicToolUIPart } from "ai";
import { getToolName, isToolUIPart } from "ai";

import { isKnownToolName } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

const TOPIC_AGENT_TOOL_NAME = "topic-agent";

export type ToolPartStatus = "done" | "error" | "pending";

type ToolPartStatusInput = {
  preliminary?: boolean;
  state: DynamicToolUIPart["state"];
};

export type TopicAgentToolPart = ToolPartStatusInput;

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
  isKnownToolName(toolName) || toolName === TOPIC_AGENT_TOOL_NAME;

export const isTopicAgentToolPart = (
  part: ThreadUIMessagePart
): part is ThreadUIMessagePart & TopicAgentToolPart => {
  if (part.type === "dynamic-tool") {
    return part.toolName === TOPIC_AGENT_TOOL_NAME;
  }

  return isToolUIPart(part) && getToolName(part) === TOPIC_AGENT_TOOL_NAME;
};
