import type { ReasoningUIPart } from "ai";
import { T } from "gt-tanstack-start";
import { ChevronRightIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { ThreadMetaLine } from "./thread-meta-line";

type AssistantReasoningPartProps = {
  part: ReasoningUIPart;
};

export const AssistantReasoningPart = ({ part }: AssistantReasoningPartProps) => (
  <Collapsible>
    <CollapsibleTrigger className="group/trigger">
      <ThreadMetaLine className={cn("flex-1 gap-0.5", part.state === "streaming" && "shimmer")}>
        {part.state === "streaming" ? <T>Thinking...</T> : <T>Thought</T>}
        <ChevronRightIcon className="size-4 shrink-0 opacity-0 transition-opacity group-hover/trigger:opacity-100 group-data-panel-open/trigger:rotate-90" />
      </ThreadMetaLine>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <ScrollArea className="*:data-[slot=scroll-area-viewport]:h-auto *:data-[slot=scroll-area-viewport]:max-h-24">
        <div className="text-sm whitespace-pre-wrap text-muted-foreground">{part.text}</div>
      </ScrollArea>
    </CollapsibleContent>
  </Collapsible>
);
