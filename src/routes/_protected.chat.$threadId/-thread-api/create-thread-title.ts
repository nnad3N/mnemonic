import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { produce } from "immer";
import * as v from "valibot";

import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getMemoryStore } from "@/mastra/memory";
import { models } from "@/mastra/models";
import {
  sidebarConversationsQuery,
  sidebarTopicThreadsQuery,
  sidebarTopicsQuery,
} from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";

const TITLE_SYSTEM_PROMPT = `
Generate a concise thread title that describes the conversation topic or intent.
Always produce a descriptive title — never repeat or lightly rephrase the user's message.
For greetings or small talk, summarize the kind of exchange (e.g. "hello" → Greeting, "how are you" → Checking In).
Return only the title.
Do not use quotation marks.
Use title case only when it reads naturally.
Keep it under 8 words.`;

const MAX_TITLE_LENGTH = 255;
const TITLE_GENERATION_TIMEOUT_MS = 10_000;

const sanitizeTitle = (value: string) => {
  const title = value
    .replaceAll(/^["'`]+|["'`]+$/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
    .trim();

  if (title.length > 0) {
    return title;
  }

  return null;
};

const createThreadTitleSchema = v.object({
  text: v.pipe(v.string(), v.nonEmpty()),
});

export const createThreadTitle = createServerFn({ method: "POST" })
  .inputValidator(createThreadTitleSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    const memoryStore = await getMemoryStore();

    const { text } = await generateText({
      model: models.threadTitle,
      prompt: data.text,
      system: TITLE_SYSTEM_PROMPT,
      abortSignal: AbortSignal.timeout(TITLE_GENERATION_TIMEOUT_MS),
    });

    const title = sanitizeTitle(text);

    if (title === null) {
      return null;
    }

    const thread = await memoryStore.updateThread({
      id: context.thread.id,
      metadata: context.thread.metadata ?? {},
      title,
    });

    return {
      id: thread.id,
      title,
      updatedAt: thread.updatedAt.toISOString(),
    };
  });

type CreateThreadTitleVars = {
  threadId: string;
  text: string;
  topicId?: string;
};

export const useCreateThreadTitle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateThreadTitleVars) =>
      createThreadTitle({ data }),
    onSuccess: (thread, vars) => {
      if (thread === null) {
        return;
      }

      const conversationsQueryOptions = sidebarConversationsQuery();

      queryClient.setQueryData(conversationsQueryOptions.queryKey, (current) =>
        produce(current, (draft) => {
          if (draft === undefined) {
            return;
          }

          for (const page of draft.pages) {
            for (const item of page.items) {
              if (item.id === thread.id) {
                item.title = thread.title;
                item.updatedAt = thread.updatedAt;
              }
            }
          }
        })
      );

      if (!vars.topicId) {
        return;
      }

      const topicsQueryOptions = sidebarTopicsQuery();

      queryClient.setQueryData(topicsQueryOptions.queryKey, (current) =>
        produce(current, (draft) => {
          if (draft === undefined) {
            return;
          }

          for (const page of draft.pages) {
            for (const topic of page.items) {
              if (topic.id !== vars.topicId) {
                continue;
              }

              for (const topicThread of topic.threads) {
                if (topicThread.id === thread.id) {
                  topicThread.title = thread.title;
                  topicThread.updatedAt = thread.updatedAt;
                }
              }
            }
          }
        })
      );

      const topicThreadsQueryOptions = sidebarTopicThreadsQuery(vars.topicId);

      queryClient.setQueryData(topicThreadsQueryOptions.queryKey, (current) =>
        produce(current, (draft) => {
          if (draft === undefined) {
            return;
          }

          for (const topicThreadPage of draft.pages) {
            for (const topicThread of topicThreadPage.items) {
              if (topicThread.id === thread.id) {
                topicThread.title = thread.title;
                topicThread.updatedAt = thread.updatedAt;
              }
            }
          }
        })
      );
    },
    onError: (error: unknown) => {
      console.error(error);
    },
  });
};
