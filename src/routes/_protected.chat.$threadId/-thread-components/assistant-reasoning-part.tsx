import type { ReasoningUIPart } from "ai";
import { T } from "gt-tanstack-start";
import { ChevronRightIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ToolIndicator } from "./tool-indicator";

type AssistantReasoningPartProps = {
  part: ReasoningUIPart;
};

export const AssistantReasoningPart = ({ part }: AssistantReasoningPartProps) => {
  return (
    <Collapsible>
      <CollapsibleTrigger
        render={<ToolIndicator interactive pending={part.state === "streaming"} />}
      >
        {part.state === "streaming" ? <T>Thinking...</T> : <T>Thought</T>}
        <ChevronRightIcon className="opacity-0 transition-opacity group-hover/tool:opacity-100 group-data-panel-open/tool:rotate-90 group-data-panel-open/tool:opacity-100" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="text-sm whitespace-pre-wrap text-muted-foreground *:data-[slot=scroll-area-viewport]:h-auto *:data-[slot=scroll-area-viewport]:max-h-24">
          {part.text}
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
};
