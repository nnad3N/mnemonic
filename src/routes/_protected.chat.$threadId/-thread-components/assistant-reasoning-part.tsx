import type { ReasoningUIPart } from "ai";
import { T } from "gt-tanstack-start";

import {
  CollapsibleToolIndicator,
  CollapsibleToolIndicatorContent,
  CollapsibleToolIndicatorTrigger,
  ToolIndicator,
} from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";

type AssistantReasoningPartProps = {
  part: ReasoningUIPart;
};

export const AssistantReasoningPart = ({ part }: AssistantReasoningPartProps) => (
  <CollapsibleToolIndicator>
    <CollapsibleToolIndicatorTrigger
      render={<ToolIndicator interactive="collapsible" pending={part.state === "streaming"} />}
    >
      {part.state === "streaming" ? <T>Thinking...</T> : <T>Thought</T>}
    </CollapsibleToolIndicatorTrigger>
    <CollapsibleToolIndicatorContent>{part.text}</CollapsibleToolIndicatorContent>
  </CollapsibleToolIndicator>
);
