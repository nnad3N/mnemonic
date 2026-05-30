import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownIcon } from "lucide-react";
import {
  StickToBottom,
  useStickToBottom,
  useStickToBottomContext,
} from "use-stick-to-bottom";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssistantMessage } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-message";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";
import { UserMessage } from "@/routes/_protected.chat.$threadId/-thread-components/user-message";

import { useChat } from "./-use-chat";

export const Route = createFileRoute("/_protected/chat/$threadId/")({
  component: RouteComponent,
});

// oxlint-disable-next-line func-style
function RouteComponent() {
  const chat = useChat();
  const stickToBottom = useStickToBottom({
    resize: "smooth",
    initial: "smooth",
  });

  return (
    <StickToBottom
      className="flex h-full min-h-0 w-full flex-col"
      instance={stickToBottom}
    >
      <ScrollArea className="h-full" viewportRef={stickToBottom.scrollRef}>
        <div ref={stickToBottom.contentRef}>
          {chat.messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} message={message} />
            ) : (
              <AssistantMessage key={message.id} message={message} />
            )
          )}
        </div>
      </ScrollArea>

      <div className="relative flex justify-center p-4 pt-2">
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
