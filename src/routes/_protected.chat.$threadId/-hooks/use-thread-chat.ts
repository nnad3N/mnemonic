import { Chat, useChat } from "@ai-sdk/react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { PrepareSendMessagesRequest, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";

import { threadSettingsQueries } from "../-thread-api/thread-settings.functions";
import { getThread } from "../-thread-api/thread.functions";
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

export const threadQueries = {
  all: () => ["thread"] as const,
  chat: (threadId: string) =>
    queryOptions({
      gcTime: Infinity,
      staleTime: Infinity,
      structuralSharing: false,
      queryKey: [...threadQueries.all(), threadId, "chat"] as const,
      queryFn: async ({ client }) => {
        const data = await getThread({
          data: { threadId },
        });

        const messages = data.messages as ThreadUIMessage[];

        const chat = new Chat({
          id: threadId,
          messages,
          onFinish: ({ messages }) => {
            useChatStore.getState().hydrateAttachments(threadId, messages);
          },
          onError: (error) => {
            console.error(error);
          },
          transport: new DefaultChatTransport({
            api: "/api/chat",
            prepareSendMessagesRequest: async ({ messages: requestMessages, ...body }) => {
              const settings = await client.ensureQueryData(
                threadSettingsQueries.byThread(threadId),
              );

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
    }),
};

export const useThreadChat = () => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const { data } = useSuspenseQuery(threadQueries.chat(threadId));

  return useChat({
    chat: data.chat,
    // Dense tool-input-delta bursts (e.g. calculate) otherwise nest
    // synchronous replaceMessage → useSyncExternalStore re-renders past React's limit.
    throttle: 32,
  });
};
