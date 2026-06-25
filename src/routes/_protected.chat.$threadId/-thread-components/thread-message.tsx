import type { ChatStatus } from "ai";
import { getToolName, isToolUIPart } from "ai";

import { isVisibleToolPart } from "@/lib/ai-sdk/tool-parts";
import { m } from "@/paraglide/messages";
import { AssistantMessage } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-message";
import { ThreadMetaLine } from "@/routes/_protected.chat.$threadId/-thread-components/thread-meta-line";
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
      (isToolUIPart(part) && isVisibleToolPart(getToolName(part)))
  );
};

type ThreadMessageProps = {
  message: ThreadUIMessage;
  index: number;
  messageCount: number;
  status: ChatStatus;
};

export const ThreadMessage = ({
  message,
  index,
  messageCount,
  status,
}: ThreadMessageProps) => {
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
        <ThreadMetaLine
          className={
            status === "streaming" || status === "submitted" ? "shimmer" : ""
          }
        >
          {m.chat_thread_pending_planning()}
        </ThreadMetaLine>
      ) : (
        <AssistantMessage
          isAnimating={status === "streaming" && index === messageCount - 1}
          message={message}
        />
      )}
    </div>
  );
};
