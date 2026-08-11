import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatStatus } from "ai";
import { T } from "gt-tanstack-start";
import { useLayoutEffect, useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

import { MessageScrollerContent, MessageScrollerViewport } from "@/components/ui/message-scroller";
import { isVisibleToolPart } from "@/lib/ai-sdk/tool-parts";
import { cn } from "@/lib/utils";
import { MessageStateContext } from "@/routes/_protected.chat.$threadId/-message-state-context";
import { ThreadError } from "@/routes/_protected.chat.$threadId/-thread-components/thread-error";
import { ThreadHeader } from "@/routes/_protected.chat.$threadId/-thread-components/thread-header";
import { ToolIndicator } from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

import { useThreadChat } from "../-hooks/use-thread-chat";
import { useChatStore } from "../../-chat-store";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

const USER_MESSAGE_ESTIMATED_SIZE = 80;
const ASSISTANT_MESSAGE_ESTIMATED_SIZE = 280;
const USER_MESSAGE_GROUP_GAP = 48;
const MESSAGE_OVERSCAN = 4;

const isPendingTurn = (status: ChatStatus, lastMessage: ThreadUIMessage | undefined): boolean => {
  if (status === "submitted") {
    return true;
  }

  if (status !== "streaming") {
    return false;
  }

  return !lastMessage?.parts.some((part) => isVisibleToolPart(part));
};

export const ThreadMessages = () => {
  const chat = useThreadChat();
  const editingMessageId = useChatStore((state) => state.editingState?.messageId);
  const isBusy = chat.status === "submitted" || chat.status === "streaming";
  const isPending = isPendingTurn(chat.status, chat.messages.at(-1));
  const [isLayoutReady, setIsLayoutReady] = useState(chat.messages.length === 0);
  const { scrollRef, scrollToBottom } = useStickToBottomContext();

  const visibleMessages = chat.messages.filter(
    (message) => message.role === "user" || message.parts.some((part) => isVisibleToolPart(part)),
  );
  const editingMessageIndex = editingMessageId
    ? visibleMessages.findIndex((message) => message.id === editingMessageId)
    : Infinity;

  const virtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const message = visibleMessages.at(index);

      if (message?.role === "user") {
        return USER_MESSAGE_ESTIMATED_SIZE + (index === 0 ? 0 : USER_MESSAGE_GROUP_GAP);
      }

      return ASSISTANT_MESSAGE_ESTIMATED_SIZE;
    },
    getItemKey: (index) => visibleMessages.at(index)?.id ?? index,
    indexAttribute: "data-index",
    overscan: MESSAGE_OVERSCAN,
  });

  useLayoutEffect(() => {
    const animationFrame = requestAnimationFrame(() => {
      void Promise.resolve(scrollToBottom({ animation: "instant" })).finally(() => {
        setIsLayoutReady(true);
      });
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [scrollToBottom]);

  return (
    <MessageScrollerViewport>
      <div className="flex min-h-full flex-col">
        <ThreadHeader />
        <MessageScrollerContent
          aria-busy={isBusy}
          aria-hidden={!isLayoutReady}
          className={cn(
            "typeset typeset-chat mx-auto mt-3 block h-auto min-h-0 w-full max-w-3xl min-w-0 flex-1 px-3 pb-64 transition-opacity",
            isLayoutReady ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const message = visibleMessages.at(virtualItem.index);

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
                  {message.role === "user" ? (
                    <UserMessage message={message} />
                  ) : (
                    <AssistantMessage
                      isStreaming={
                        chat.status === "streaming" && message.id === chat.messages.at(-1)?.id
                      }
                      message={message}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {isPending && (
            <div className="px-2">
              <MessageStateContext.Provider value={{ isStreaming: true }}>
                <ToolIndicator pending>
                  <T>Planning next moves...</T>
                </ToolIndicator>
              </MessageStateContext.Provider>
            </div>
          )}
          <ThreadError />
        </MessageScrollerContent>
      </div>
    </MessageScrollerViewport>
  );
};
