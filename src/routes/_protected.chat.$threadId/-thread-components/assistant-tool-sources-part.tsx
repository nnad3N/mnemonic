import type { ToolUIPart } from "ai";
import { T } from "gt-tanstack-start";
import { GlobeIcon } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

type WebSearchToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-webSearch" }>;
type WebFetchToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-webFetch" }>;

type WebSourcesToolPart = WebSearchToolPart | WebFetchToolPart;

type ToolSourceLink = {
  url: string;
  title?: string;
};

type AssistantToolSourcesPartProps = {
  part: WebSourcesToolPart;
};

const getSourceLinks = (part: WebSourcesToolPart): ToolSourceLink[] => {
  switch (part.type) {
    case "tool-webSearch": {
      if (part.output?.type === "success") {
        return part.output.results.map((result) => ({
          url: result.url,
          title: result.title,
        }));
      }

      return [];
    }
    case "tool-webFetch": {
      if (part.output?.type === "success") {
        return [{ url: part.output.url, title: part.output.title }];
      }

      return [];
    }
  }
};

export const AssistantToolSourcesPart = ({ part }: AssistantToolSourcesPartProps) => {
  const links = getSourceLinks(part);

  if (links.length === 0) {
    return <AssistantToolPart part={part} />;
  }

  return (
    <Popover>
      <PopoverTrigger>
        <AssistantToolPart part={part} className="transition-colors hover:text-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-1 text-sm">
        <ScrollArea className="h-96 p-1">
          <p className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground">
            <GlobeIcon className="size-4" /> <T>Search results</T>
          </p>
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.url}>
                <a
                  className="block rounded-lg px-2 py-1 transition-colors hover:bg-accent"
                  href={link.url}
                  rel="noopener"
                  target="_blank"
                >
                  {link.title ?? link.url}
                </a>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
