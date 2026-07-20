import { createFileRoute } from "@tanstack/react-router";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";
import { ThreadError } from "@/routes/_protected.chat.$threadId/-thread-components/thread-error";
import { ThreadMessage } from "@/routes/_protected.chat.$threadId/-thread-components/thread-message";

import { useChatStore } from "../-chat-store";
import { useThreadChat } from "./-thread-chat-provider";

export const Route = createFileRoute("/_protected/chat/$threadId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });
  const chat = useThreadChat();
  const editingMessageIndex = useChatStore((state) => state.editingState?.messageIndex) ?? Infinity;
  const isBusy = chat.status === "submitted" || chat.status === "streaming";

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" key={threadId}>
      <div className="typeset typeset-chat flex h-full min-h-0 w-full flex-col p-3">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent
              aria-busy={isBusy}
              className="mx-auto w-full max-w-3xl min-w-0 gap-2.5 pb-64"
            >
              {chat.messages.map((message, index) => (
                <MessageScrollerItem
                  className={cn(
                    index > editingMessageIndex && "opacity-50",
                    message.role === "user" && index !== 0 && "pt-12",
                  )}
                  key={message.id}
                  messageId={message.id}
                >
                  <ThreadMessage
                    index={index}
                    messageCount={chat.messages.length}
                    message={message}
                    status={chat.status}
                  />
                </MessageScrollerItem>
              ))}
              <ThreadError />
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>

        <div className="relative mx-auto flex w-full max-w-3xl justify-center">
          <ThreadComposer location="main" />
        </div>
      </div>
    </MessageScrollerProvider>
  );
}
