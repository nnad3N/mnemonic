import { Chat, useChat } from "@ai-sdk/react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { PrepareSendMessagesRequest, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";

import { getThread } from "../-thread-api/get-thread";
import { threadKeys } from "../-thread-api/query-keys";
import { threadSettingsQuery } from "../-thread-api/settings";
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

export const threadChatQuery = (threadId: string) =>
  queryOptions({
    gcTime: Infinity,
    staleTime: Infinity,
    structuralSharing: false,
    queryKey: threadKeys.chat(threadId),
    queryFn: async ({ client }) => {
      const data = await getThread({
        data: { threadId },
      });

      const chat = new Chat({
        id: threadId,
        messages: data.messages as ThreadUIMessage[],
        onFinish: ({ isError, messages }) => {
          useChatStore.getState().hydrateAttachments(threadId, messages);
          useChatStore.getState().setThreadIndicator(threadId, isError ? "error" : "ready");
        },
        onError: (error) => {
          console.error(error);
        },
        transport: new DefaultChatTransport({
          api: "/api/chat",
          prepareSendMessagesRequest: async ({ messages: requestMessages, ...body }) => {
            useChatStore.getState().setThreadIndicator(threadId, "pending");
            const settings = await client.ensureQueryData(threadSettingsQuery(threadId));

            return {
              body: {
                ...body,
                messages: getMessagesToSend(requestMessages, body.trigger),
                resourceId: data.resourceId,
                settings: { modelCapability: settings.modelCapability },
                threadId,
              },
            };
          },
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
