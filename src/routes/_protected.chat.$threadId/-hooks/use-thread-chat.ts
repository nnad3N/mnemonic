import { Chat, useChat } from "@ai-sdk/react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { PrepareSendMessagesRequest, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";

import { getThread } from "../-thread-api/get-thread";
import { threadKeys } from "../-thread-api/query-keys";
import { saveAbortedMessages } from "../-thread-api/save-aborted-messages";
import type { ThreadUIMessage } from "../-thread-types";
import { useChatStore } from "../../-chat-store";

const Route = getRouteApi("/_protected/chat/$threadId");

type ChatSendTrigger = Parameters<PrepareSendMessagesRequest<UIMessage>>[0]["trigger"];

export const getMessagesToSend = <TMessage extends UIMessage>(
  messages: TMessage[],
  trigger: ChatSendTrigger,
): TMessage[] => {
  const lastMessage = messages.at(-1);

  if (!lastMessage) {
    return [];
  }

  const previousMessage = messages.at(-2);
  const isRegenerateAssistant =
    trigger === "regenerate-message" && lastMessage.role === "assistant";

  if (isRegenerateAssistant && previousMessage) {
    return [previousMessage, lastMessage];
  }

  return [lastMessage];
};

/** Aborted-turn patch — `onFinish.messages` is the full thread; only ship a delta. */
export type AbortedMessagePatch<TMessage extends UIMessage = UIMessage> = {
  add: TMessage[];
  deleteIds: string[];
};

export const getAbortedMessagePatch = <TMessage extends UIMessage>(
  messages: TMessage[],
  persistedIds: Set<string>,
): AbortedMessagePatch<TMessage> => {
  const liveIds = new Set(messages.map((message) => message.id));
  const deleteIds: string[] = [];

  for (const id of persistedIds) {
    if (!liveIds.has(id)) {
      deleteIds.push(id);
    }
  }

  const lastUserIndex = messages.findLastIndex((message) => message.role === "user");

  return {
    add: lastUserIndex === -1 ? [] : messages.slice(lastUserIndex),
    deleteIds,
  };
};

export const threadChatQuery = (threadId: string) =>
  queryOptions({
    gcTime: Infinity,
    staleTime: Infinity,
    structuralSharing: false,
    queryKey: threadKeys.chat(threadId),
    queryFn: async () => {
      const data = await getThread({
        data: { threadId },
      });

      const persistedIds = new Set(data.messages.map((message) => message.id));

      const chat = new Chat({
        id: threadId,
        messages: data.messages as ThreadUIMessage[],
        onFinish: ({ messages: finishedMessages, isAbort }) => {
          useChatStore.getState().hydrateAttachments(threadId, finishedMessages);

          // Mastra skips memory.saveMessages on abort. Persist the turn here and
          // keep the live Chat — invalidate would refetch the same payload.
          if (!isAbort) {
            return;
          }

          const patch = getAbortedMessagePatch(finishedMessages, persistedIds);

          if (patch.add.length > 0 || patch.deleteIds.length > 0) {
            void saveAbortedMessages({
              data: {
                threadId,
                add: patch.add,
                deleteIds: patch.deleteIds,
              },
            });
          }
        },
        onError: (error) => {
          console.error(error);
        },
        transport: new DefaultChatTransport({
          api: "/api/chat",
          prepareSendMessagesRequest: ({ messages: requestMessages, ...body }) => ({
            body: {
              ...body,
              messages: getMessagesToSend(requestMessages, body.trigger),
              resourceId: data.resourceId,
              threadId,
            },
          }),
        }),
      });

      return {
        chat,
        resourceId: data.resourceId,
        topicId: data.topicId,
      };
    },
  });

export const useThreadChat = () => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const { data } = useSuspenseQuery(threadChatQuery(threadId));

  return useChat({
    chat: data.chat,
    // Dense tool-input-delta bursts (e.g. executeCode) otherwise nest
    // synchronous replaceMessage → useSyncExternalStore re-renders past React's limit.
    experimental_throttle: 32,
  });
};
