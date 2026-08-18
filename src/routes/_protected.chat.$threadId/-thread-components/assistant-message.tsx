import { isVisibleOmPart } from "@/lib/ai-sdk/tool-parts";
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
  const workTimings =
    message.metadata?.type === "assistant" ? message.metadata.workTimings : undefined;
  const blocks = groupAssistantParts(message.parts, workTimings);

  return (
    <MessageStateContext.Provider value={{ isStreaming }}>
      <div className="flex flex-col gap-2 px-2">
        {blocks.map((block) => {
          if (block.type === "text") {
            return <AssistantMessagePart key={block.id} part={block.part} />;
          }

          // Memory work lands on the reply after it has settled, so on its own it is not part
          // of the run and reports no work.
          if (block.parts.length === 1 && isVisibleOmPart(block.parts[0])) {
            return <AssistantMessagePart key={block.id} part={block.parts[0]} />;
          }

          return <WorkedForIndicator key={block.id} parts={block.parts} timing={block.timing} />;
        })}
      </div>
    </MessageStateContext.Provider>
  );
};
