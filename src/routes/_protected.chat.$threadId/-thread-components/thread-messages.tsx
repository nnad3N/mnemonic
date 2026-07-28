import { useVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState } from "react";

import { MessageScrollerContent, MessageScrollerViewport } from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";
import { ThreadError } from "@/routes/_protected.chat.$threadId/-thread-components/thread-error";
import { ThreadMessage } from "@/routes/_protected.chat.$threadId/-thread-components/thread-message";

import { useThreadChat } from "../-thread-chat-provider";
import { useChatStore } from "../../-chat-store";

const USER_MESSAGE_ESTIMATED_SIZE = 80;
const ASSISTANT_MESSAGE_ESTIMATED_SIZE = 280;
const USER_MESSAGE_GROUP_GAP = 48;
const MESSAGE_OVERSCAN = 4;

export const ThreadMessages = () => {
  const chat = useThreadChat();
  const editingMessageIndex = useChatStore((state) => state.editingState?.messageIndex) ?? Infinity;
  const isBusy = chat.status === "submitted" || chat.status === "streaming";
  const viewportRef = useRef<HTMLDivElement>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(chat.messages.length === 0);

  const virtualizer = useVirtualizer({
    count: chat.messages.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) => {
      const message = chat.messages.at(index);

      if (message?.role === "user") {
        return USER_MESSAGE_ESTIMATED_SIZE + (index === 0 ? 0 : USER_MESSAGE_GROUP_GAP);
      }

      return ASSISTANT_MESSAGE_ESTIMATED_SIZE;
    },
    getItemKey: (index) => chat.messages.at(index)?.id ?? index,
    indexAttribute: "data-test-index",
    overscan: MESSAGE_OVERSCAN,
    anchorTo: "end",
  });

  useLayoutEffect(() => {
    let cancelled = false;
    let frameId = 0;
    let lastScrollHeight = -1;
    let stableFrames = 0;

    // Virtual rows measure after paint; keep pinning to the end until
    // scrollHeight stops growing so the first visible frame is not mid-shift.
    const pinToEndUntilStable = () => {
      if (cancelled) return;

      const scrollElement = viewportRef.current;
      if (!scrollElement) return;

      scrollElement.scrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;

      if (scrollElement.scrollHeight === lastScrollHeight) {
        stableFrames += 1;
      } else {
        lastScrollHeight = scrollElement.scrollHeight;
        stableFrames = 0;
      }

      if (stableFrames > 0) {
        setIsLayoutReady(true);
        return;
      }

      frameId = requestAnimationFrame(pinToEndUntilStable);
    };

    frameId = requestAnimationFrame(pinToEndUntilStable);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <MessageScrollerViewport data-test-id="message-scroller-viewport" ref={viewportRef}>
      <MessageScrollerContent
        aria-busy={isBusy}
        aria-hidden={!isLayoutReady}
        className={cn(
          "mx-auto block w-full max-w-3xl min-w-0 pb-64 transition-opacity",
          isLayoutReady ? "opacity-100" : "opacity-0",
        )}
        data-test-layout-ready={isLayoutReady ? "true" : "false"}
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
                data-test-index={virtualItem.index}
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
};
