import { Chat, useChat } from "@ai-sdk/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { DefaultChatTransport, type PrepareSendMessagesRequest, type UIMessage } from "ai";
import { panic } from "better-result";
import type { PropsWithChildren } from "react";
import { use, useEffect, useState } from "react";

import { useChatStore } from "../-chat-store";
import { FilesSync } from "../_protected.topic.$topicId/-topic-components/files-sync";
import { threadQuery } from "./-thread-api/get-thread";
import { threadKeys } from "./-thread-api/query-keys";
import { ThreadChatContext } from "./-thread-chat-context";

type ChatSendTrigger = Parameters<PrepareSendMessagesRequest<UIMessage>>[0]["trigger"];

const getMessagesToSend = <TMessage extends UIMessage>(
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

type ThreadChatProviderProps = {
  threadId: string;
};

export const ThreadChatProvider = ({
  threadId,
  children,
}: PropsWithChildren<ThreadChatProviderProps>) => {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(threadQuery(threadId));
  const [chat] = useState(
    () =>
      new Chat({
        id: threadId,
        messages: data.messages,
        onFinish: ({ messages }) => {
          useChatStore.getState().hydrateAttachments(threadId, messages);

          void queryClient.invalidateQueries({
            queryKey: threadKeys.byId(threadId),
          });
        },
        onError: (error) => {
          console.error(error);
        },
        transport: new DefaultChatTransport({
          api: "/api/chat",
          prepareSendMessagesRequest: ({ messages, ...body }) => ({
            body: {
              ...body,
              messages: getMessagesToSend(messages, body.trigger),
              resourceId: data.resourceId,
              threadId,
            },
          }),
        }),
      }),
  );

  useEffect(() => {
    useChatStore.getState().hydrateAttachments(threadId, data.messages);
  }, [data.messages, threadId]);

  return (
    <ThreadChatContext.Provider value={chat}>
      {data.topicId && <FilesSync topicId={data.topicId} />}
      {children}
    </ThreadChatContext.Provider>
  );
};

export const useThreadChat = () => {
  const threadChat = use(ThreadChatContext);

  if (!threadChat) {
    panic("useThreadChatContext must be used within ThreadChatProvider");
  }

  const chat = useChat({
    chat: threadChat,
  });

  return chat;
};
