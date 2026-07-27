import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ChevronRightIcon } from "lucide-react";
import type { ComponentProps, PropsWithChildren } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMessageState } from "@/routes/_protected.chat.$threadId/-hooks/use-message-state";

export type ToolIndicatorInteractive = "button" | "collapsible";

export type ToolIndicatorProps = useRender.ComponentProps<"div"> & {
  enabled?: boolean;
  interactive?: ToolIndicatorInteractive;
  pending?: boolean;
};

export const ToolIndicator = ({
  className,
  render,
  enabled,
  interactive,
  pending = false,
  ...props
}: ToolIndicatorProps) => {
  const { isStreaming } = useMessageState();

  const isInteractive = interactive === "collapsible" || (interactive === "button" && !pending);

  return useRender({
    enabled,
    defaultTagName: isInteractive ? "button" : "div",
    props: mergeProps(
      {
        className: cn(
          "flex w-max items-center gap-0.5 text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          pending && isStreaming && "shimmer",
          isInteractive && "group/tool transition-colors hover:text-foreground",
          className,
        ),
      },
      props,
    ),
    render,
  });
};

export const CollapsibleToolIndicator = Collapsible;

export const CollapsibleToolIndicatorTrigger = ({
  children,
  ...props
}: PropsWithChildren<ComponentProps<typeof CollapsibleTrigger>>) => (
  <CollapsibleTrigger {...props}>
    {children}
    <ChevronRightIcon className="opacity-0 transition-opacity group-hover/tool:opacity-100 group-data-panel-open/tool:rotate-90 group-data-panel-open/tool:opacity-100" />
  </CollapsibleTrigger>
);

export const CollapsibleToolIndicatorContent = ({
  className,
  children,
  ...props
}: PropsWithChildren<ComponentProps<typeof CollapsibleContent>>) => (
  <CollapsibleContent {...props}>
    <ScrollArea
      className={cn(
        "text-sm whitespace-pre-wrap text-muted-foreground *:data-[slot=scroll-area-viewport]:h-auto *:data-[slot=scroll-area-viewport]:max-h-24",
        className,
      )}
    >
      {children}
    </ScrollArea>
  </CollapsibleContent>
);
