import type { ChatStatus } from "ai";
import { getToolName, isToolUIPart } from "ai";
import { T } from "gt-tanstack-start";

import { MessageStateContext } from "@/routes/_protected.chat.$threadId/-message-state-context";
import { AssistantMessage } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-message";
import { ToolIndicator } from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";
import { isKnownToolName } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import { UserMessage } from "@/routes/_protected.chat.$threadId/-thread-components/user-message";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

type IsWithoutVisiblePartsProps = {
  status: ChatStatus;
  message: ThreadUIMessage;
  index: number;
  messageCount: number;
};

const isWithoutVisibleParts = ({
  status,
  message,
  index,
  messageCount,
}: IsWithoutVisiblePartsProps): boolean => {
  if (index !== messageCount - 1) {
    return false;
  }

  if (status === "submitted") {
    return true;
  }

  if (status !== "streaming" || message.role !== "assistant") {
    return false;
  }

  return !message.parts.some(
    (part) =>
      part.type === "reasoning" ||
      part.type === "text" ||
      (isToolUIPart(part) && isKnownToolName(getToolName(part))),
  );
};

type ThreadMessageProps = {
  message: ThreadUIMessage;
  index: number;
  messageCount: number;
  status: ChatStatus;
};

export const ThreadMessage = ({ message, index, messageCount, status }: ThreadMessageProps) => {
  if (message.role === "user") {
    return <UserMessage message={message} index={index} />;
  }

  return (
    <div className="px-2">
      {isWithoutVisibleParts({
        status,
        message,
        index,
        messageCount,
      }) ? (
        <MessageStateContext.Provider value={{ isAnimating: true }}>
          <ToolIndicator pending={status === "streaming" || status === "submitted"}>
            <T>Planning next moves...</T>
          </ToolIndicator>
        </MessageStateContext.Provider>
      ) : (
        <AssistantMessage
          isAnimating={status === "streaming" && index === messageCount - 1}
          message={message}
        />
      )}
    </div>
  );
};
