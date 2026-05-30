import { useChat as useChatPrimitive } from "@ai-sdk/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { threadQuery } from "./-thread-api/get-thread";

export const useChat = () => {
  const { threadId } = useParams({
    from: "/_protected/chat/$threadId",
  });
  const { data } = useSuspenseQuery(threadQuery(threadId));
  const chat = useChatPrimitive({ chat: data });

  return chat;
};
