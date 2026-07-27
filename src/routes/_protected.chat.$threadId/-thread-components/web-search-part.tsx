import type { ToolUIPart } from "ai";
import { T } from "gt-tanstack-start";
import { GlobeIcon } from "lucide-react";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { useExternalLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

type WebSearchToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-webSearch" }>;

type WebSearchPartProps = {
  part: WebSearchToolPart;
};

export const WebSearchPart = ({ part }: WebSearchPartProps) => {
  const { externalLinkModal, requestExternalLink } = useExternalLinkSafety();
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (part.output?.type !== "success") {
    return <AssistantToolPart part={part} />;
  }

  const links = part.output.results.map((result) => ({
    url: result.url,
    title: result.title,
  }));

  return (
    <>
      <Popover modal={false} onOpenChange={setPopoverOpen} open={popoverOpen}>
        <PopoverTrigger
          openOnHover
          render={<AssistantToolPart interactive="button" part={part} />}
        />
        <PopoverContent align="start" className="w-96 p-1 text-sm">
          <ScrollArea className="p-1 *:data-[slot=scroll-area-viewport]:h-auto *:data-[slot=scroll-area-viewport]:max-h-96">
            <p className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground">
              <GlobeIcon className="size-4" />
              <T>Search results</T>
            </p>
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.url}>
                  <button
                    className="block w-full rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent"
                    onClick={() => {
                      setPopoverOpen(false);
                      requestExternalLink(link.url);
                    }}
                    type="button"
                  >
                    {link.title ?? link.url}
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {externalLinkModal}
    </>
  );
};
