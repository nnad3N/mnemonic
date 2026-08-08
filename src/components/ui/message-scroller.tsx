import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import { ArrowDownIcon } from "lucide-react";
import * as React from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { Button } from "@/components/ui/button";
import { ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

function MessageScrollerProvider(props: React.ComponentProps<typeof StickToBottom>) {
  return <StickToBottom initial="instant" resize="smooth" {...props} />;
}

function MessageScroller({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerViewport({
  className,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>) {
  const { scrollRef } = useStickToBottomContext();

  return (
    <ScrollAreaPrimitive.Root
      data-slot="message-scroller-scroll-area"
      className="relative size-full min-h-0 min-w-0"
    >
      <ScrollAreaPrimitive.Viewport
        ref={scrollRef}
        data-slot="message-scroller-viewport"
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          "scroll-fade-b overscroll-contain contain-content",
          className,
        )}
        {...props}
      />
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function MessageScrollerContent({ className, ...props }: React.ComponentProps<"div">) {
  const { contentRef } = useStickToBottomContext();

  return (
    <div
      ref={contentRef}
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-8", className)}
      {...props}
    />
  );
}

function MessageScrollerButton({
  className,
  children,
  variant = "secondary",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    <Button
      data-slot="message-scroller-button"
      data-active={!isAtBottom}
      variant={variant}
      size={size}
      onClick={() => void scrollToBottom({ animation: "smooth", ignoreEscapes: true })}
      className={cn(
        "absolute inset-s-1/2 bottom-4 -translate-x-1/2 border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:translate-y-full data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] rtl:translate-x-1/2",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <ArrowDownIcon />
          <span className="sr-only">Scroll to end</span>
        </>
      )}
    </Button>
  );
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerButton,
};
