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
import { AssistantMessage } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-message";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";
import { ThreadError } from "@/routes/_protected.chat.$threadId/-thread-components/thread-error";
import { ThreadPending } from "@/routes/_protected.chat.$threadId/-thread-components/thread-pending";
import { UserMessage } from "@/routes/_protected.chat.$threadId/-thread-components/user-message";

import { useThreadChat } from "./-hooks/use-thread-chat";
import { useThreadStore } from "./-thread-store";

export const Route = createFileRoute("/_protected/chat/$threadId/")({
  component: RouteComponent,
});

// oxlint-disable-next-line func-style
function RouteComponent() {
  const chat = useThreadChat();
  const editingMessageIndex =
    useThreadStore((state) => state.editingState?.messageIndex) ?? Infinity;
  const stickToBottom = useStickToBottom({
    resize: "smooth",
    initial: "instant",
  });

  return (
    <StickToBottom
      className="flex h-full min-h-0 w-full flex-col p-3"
      instance={stickToBottom}
    >
      <ScrollArea className="h-full" viewportRef={stickToBottom.scrollRef}>
        <div
          className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-2 px-4 pb-4"
          ref={stickToBottom.contentRef}
        >
          {chat.messages.map((message, index) => (
            <div
              className={cn(index > editingMessageIndex && "opacity-50")}
              key={message.id}
            >
              {message.role === "user" ? (
                <UserMessage message={message} index={index} />
              ) : (
                <AssistantMessage message={message} />
              )}
            </div>
          ))}
          <ThreadPending />
          <ThreadError />
        </div>
      </ScrollArea>

      <div className="relative mx-auto flex w-full max-w-lg justify-center">
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
