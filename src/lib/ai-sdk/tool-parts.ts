import type { DynamicToolUIPart } from "ai";
import { getToolName, isToolUIPart } from "ai";

import { isKnownToolName } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

/** Mastra supervisor `agents: { topic }` → AI SDK tool name `agent-topic`. */
const TOPIC_AGENT_TOOL_NAME = "agent-topic";

export type ToolPartStatus = "done" | "error" | "pending";

type ToolPartStatusInput = {
  preliminary?: boolean;
  state: DynamicToolUIPart["state"];
};

export type TopicAgentToolPart = DynamicToolUIPart & ToolPartStatusInput;

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
): part is ThreadUIMessagePart & TopicAgentToolPart =>
  isToolUIPart(part) && getToolName(part) === TOPIC_AGENT_TOOL_NAME;
