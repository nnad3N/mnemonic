import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { TsrSerializable } from "@tanstack/router-core";

import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getMemoryStore } from "@/mastra/memory";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

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
      }) as (ThreadUIMessage & TsrSerializable)[],
      resourceId: context.thread.resourceId,
    };
  });

export const threadQuery = (threadId: string) =>
  queryOptions({
    queryFn: async () => {
      const data = await getThread({
        data: { threadId },
      });

      return {
        resourceId: data.resourceId,
        messages: data.messages as ThreadUIMessage[],
      };
    },
    queryKey: threadKeys.byId(threadId),
    staleTime: Infinity,
  });
