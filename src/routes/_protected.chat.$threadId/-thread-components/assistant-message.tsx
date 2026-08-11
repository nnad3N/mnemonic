import { groupAssistantParts } from "@/lib/ai-sdk/work-part";
import { MessageStateContext } from "@/routes/_protected.chat.$threadId/-message-state-context";
import { AssistantMessagePart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-message-part";
import { WorkedForIndicator } from "@/routes/_protected.chat.$threadId/-thread-components/worked-for-indicator";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

type AssistantMessageProps = {
  isStreaming: boolean;
  message: ThreadUIMessage;
};

export const AssistantMessage = ({ isStreaming, message }: AssistantMessageProps) => {
  const blocks = groupAssistantParts(message.parts);

  return (
    <MessageStateContext.Provider value={{ isStreaming }}>
      <div className="flex flex-col gap-2 px-2">
        {blocks.map((block) =>
          block.type === "text" ? (
            <AssistantMessagePart key={block.id} messageParts={message.parts} part={block.part} />
          ) : (
            <WorkedForIndicator key={block.id} messageParts={message.parts} parts={block.parts} />
          ),
        )}
      </div>
    </MessageStateContext.Provider>
  );
};
