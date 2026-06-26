import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownIcon } from "lucide-react";
import {
  StickToBottom,
  useStickToBottom,
  useStickToBottomContext,
} from "use-stick-to-bottom";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";
import { ThreadError } from "@/routes/_protected.chat.$threadId/-thread-components/thread-error";
import { ThreadMessage } from "@/routes/_protected.chat.$threadId/-thread-components/thread-message";

import { useThreadChat } from "./-thread-chat-provider";
import { useThreadStore } from "./-thread-store";

export const Route = createFileRoute("/_protected/chat/$threadId/")({
  component: RouteComponent,
});

// oxlint-disable-next-line func-style
function RouteComponent() {
  const chat = useThreadChat();
  const stickToBottom = useStickToBottom({
    resize: "smooth",
    initial: "instant",
  });
  const editingMessageIndex =
    useThreadStore((state) => state.editingState?.messageIndex) ?? Infinity;

  return (
    <StickToBottom
      className="flex h-full min-h-0 w-full flex-col p-3"
      instance={stickToBottom}
    >
      <ScrollArea
        className="h-full min-h-0"
        viewportRef={stickToBottom.scrollRef}
      >
        <div
          className="mx-auto flex w-full max-w-xl min-w-0 flex-col gap-2.5 pb-4"
          ref={stickToBottom.contentRef}
        >
          {chat.messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(index > editingMessageIndex && "opacity-50")}
            >
              <ThreadMessage
                index={index}
                messageCount={chat.messages.length}
                message={message}
                status={chat.status}
              />
            </div>
          ))}
          <ThreadError />
        </div>
      </ScrollArea>

      <div className="relative mx-auto flex w-full max-w-xl justify-center">
        <ScrollToBottomButton />
        <ThreadComposer location="main" />
      </div>
    </StickToBottom>
  );
}

const ScrollToBottomButton = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) {
    return null;
  }

  return (
    <Button
      className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2"
      onClick={async () => {
        await scrollToBottom();
      }}
      size="icon-sm"
      type="button"
      variant="outline"
    >
      <ArrowDownIcon />
    </Button>
  );
};
