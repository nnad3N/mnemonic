import { Chat, useChat } from "@ai-sdk/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import { panic } from "better-result";
import type { PropsWithChildren } from "react";
import { useContext, useState } from "react";

import { ArtifactsSync } from "../_protected.topic.$topicId/-topic-components/artifacts-sync";
import { threadQuery } from "./-thread-api/get-thread";
import { threadKeys } from "./-thread-api/query-keys";
import { ThreadChatContext } from "./-thread-chat-context";

type ThreadChatProviderProps = {
  threadId: string;
};

export const ThreadChatProvider = ({
  children,
  threadId,
}: PropsWithChildren<ThreadChatProviderProps>) => {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(threadQuery(threadId));
  const [chat] = useState(
    () =>
      new Chat({
        id: threadId,
        messages: data.messages,
        onFinish: () => {
          void queryClient.invalidateQueries({
            queryKey: threadKeys.byId(threadId),
          });
        },
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
        <ArtifactsSync threadId={threadId} topicId={data.topicId} />
      )}
      {children}
    </ThreadChatContext.Provider>
  );
};

export const useThreadChat = () => {
  const threadChat = useContext(ThreadChatContext);

  if (!threadChat) {
    panic("useThreadChatContext must be used within ThreadChatProvider");
  }

  const chat = useChat({
    chat: threadChat,
  });

  return chat;
};
