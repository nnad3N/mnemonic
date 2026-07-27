import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
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

const MESSAGE_ESTIMATED_SIZE = 62;
const MESSAGE_OVERSCAN = 8;

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" key={threadId}>
      <div className="typeset typeset-chat flex h-full min-h-0 w-full flex-col p-3">
        <MessageScroller className="min-h-0 flex-1">
          <ThreadMessages />
          <MessageScrollerButton />
        </MessageScroller>

        <div className="relative mx-auto flex w-full max-w-3xl justify-center">
          <ThreadComposer location="main" />
        </div>
      </div>
    </MessageScrollerProvider>
  );
}

function ThreadMessages() {
  const chat = useThreadChat();
  const editingMessageIndex = useChatStore((state) => state.editingState?.messageIndex) ?? Infinity;
  const isBusy = chat.status === "submitted" || chat.status === "streaming";
  const viewportRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: chat.messages.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => MESSAGE_ESTIMATED_SIZE,
    getItemKey: (index) => chat.messages.at(index)?.id ?? index,
    overscan: MESSAGE_OVERSCAN,
  });

  return (
    <MessageScrollerViewport ref={viewportRef}>
      <MessageScrollerContent
        aria-busy={isBusy}
        className="mx-auto block w-full max-w-3xl min-w-0 pb-64"
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const message = chat.messages.at(virtualItem.index);

            if (!message) {
              return null;
            }

            return (
              <div
                className={cn(
                  "absolute inset-s-0 top-0 w-full pb-2.5",
                  virtualItem.index > editingMessageIndex && "opacity-50",
                  message.role === "user" && virtualItem.index !== 0 && "pt-12",
                )}
                data-index={virtualItem.index}
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ThreadMessage
                  index={virtualItem.index}
                  messageCount={chat.messages.length}
                  message={message}
                  status={chat.status}
                />
              </div>
            );
          })}
        </div>
        <ThreadError />
      </MessageScrollerContent>
    </MessageScrollerViewport>
  );
}
