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
  const timing = message.metadata?.type === "assistant" ? message.metadata : undefined;
  const workEndedAt = timing?.workEndedAt ?? [];

  return (
    <MessageStateContext.Provider value={{ isStreaming }}>
      <div className="flex flex-col gap-2 px-2">
        {blocks.map((block) => {
          if (block.type === "text") {
            return (
              <AssistantMessagePart key={block.id} messageParts={message.parts} part={block.part} />
            );
          }

          // A run lasts from the reply's start, or the text before it, until the text after
          // it starts — or the run ends without one.
          const textIndex = message.parts
            .slice(0, block.startIndex)
            .filter((part) => part.type === "text").length;

          return (
            <WorkedForIndicator
              completedAt={workEndedAt.at(textIndex)}
              key={block.id}
              messageParts={message.parts}
              parts={block.parts}
              startedAt={
                textIndex === 0 ? timing?.startedAt : workEndedAt.at(textIndex - 1)
              }
            />
          );
        })}
      </div>
    </MessageStateContext.Provider>
  );
};
