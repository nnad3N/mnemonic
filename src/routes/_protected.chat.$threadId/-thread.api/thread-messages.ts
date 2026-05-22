import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { TsrSerializable } from "@tanstack/router-core";
import type { UIMessage } from "ai";
import * as v from "valibot";

import { db } from "@/db";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { getMemoryStore } from "@/mastra/memory";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread.api/query-keys";

export const getThreadMessages = createServerFn({ method: "GET" })
  .inputValidator(
    v.object({
      threadId: v.pipe(v.string(), v.nonEmpty()),
    })
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const memoryStore = await getMemoryStore();
    const thread = await memoryStore.getThreadById({
      threadId: data.threadId,
    });

    if (thread === null) {
      throw notFound();
    }

    if (thread.resourceId !== context.user.id) {
      const ownedTopic = await db.query.topic.findFirst({
        where: {
          id: thread.resourceId,
          userId: context.user.id,
        },
        columns: { id: true },
      });

      if (!ownedTopic) {
        throw notFound();
      }
    }

    const { messages } = await memoryStore.listMessages({
      threadId: data.threadId,
      page: 0,
      perPage: false,
    });

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- UIMessage metadata is `unknown`; runtime value is JSON-serializable
    return toAISdkMessages(messages, {
      version: "v6",
    }) as (UIMessage & TsrSerializable)[];
  });

export const threadMessagesQuery = (threadId: string) =>
  queryOptions({
    queryFn: async () => {
      const messages = await getThreadMessages({
        data: { threadId },
      });

      return messages;
    },
    queryKey: threadKeys.messages(threadId),
  });
