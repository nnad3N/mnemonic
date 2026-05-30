import { Chat } from "@ai-sdk/react";
import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { TsrSerializable } from "@tanstack/router-core";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";

import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getMemoryStore } from "@/mastra/memory";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";

export const getThread = createServerFn({ method: "GET" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) => {
    const memoryStore = await getMemoryStore();
    const { messages } = await memoryStore.listMessages({
      threadId: context.thread.id,
      page: 0,
      perPage: false,
    });

    return {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      messages: toAISdkMessages(messages, {
        version: "v6",
      }) as (UIMessage & TsrSerializable)[],
      resourceId: context.thread.resourceId,
    };
  });

export const threadQuery = (threadId: string) =>
  queryOptions({
    queryFn: async () => {
      const data = await getThread({
        data: { threadId },
      });

      const chat = new Chat({
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
      });

      return chat;
    },
    queryKey: threadKeys.byId(threadId),
    staleTime: Infinity,
    structuralSharing: false,
  });
