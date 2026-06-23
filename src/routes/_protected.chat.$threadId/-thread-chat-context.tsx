import { Chat, useChat } from "@ai-sdk/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { panic } from "better-result";
import { createContext, useContext, useState } from "react";
import type { PropsWithChildren } from "react";

import { threadQuery } from "./-thread-api/get-thread";
import { TopicMentionsSync } from "./-thread-components/topic-mentions-sync";
import type { ThreadUIMessage } from "./-thread-types";

const ThreadChatContext = createContext<Chat<ThreadUIMessage> | null>(null);

type ThreadChatProviderProps = {
  threadId: string;
};

export const ThreadChatProvider = ({
  children,
  threadId,
}: PropsWithChildren<ThreadChatProviderProps>) => {
  const { data } = useSuspenseQuery(threadQuery(threadId));
  const [chat] = useState(
    () =>
      new Chat({
        id: threadId,
        messages: data.messages,
        transport: new DefaultChatTransport({
          api: "/api/chat",
          prepareSendMessagesRequest: (options) => ({
            body: {
              ...options,
              resourceId: data.resourceId,
              threadId,
            },
          }),
        }),
      })
  );

  return (
    <ThreadChatContext.Provider value={chat}>
      {data.topicId && (
        <TopicMentionsSync threadId={threadId} topicId={data.topicId} />
      )}
      {children}
    </ThreadChatContext.Provider>
  );
};

export const useThreadChat = () => {
  const threadChat = useContext(ThreadChatContext);

  if (threadChat === null) {
    panic("useThreadChatContext must be used within ThreadChatProvider");
  }

  const chat = useChat({
    chat: threadChat,
  });

  return chat;
};
