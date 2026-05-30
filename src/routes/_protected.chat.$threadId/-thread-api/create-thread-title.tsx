import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { generateText, gateway } from "ai";
import * as v from "valibot";

import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getMemoryStore } from "@/mastra/memory";
import { models } from "@/mastra/models";
import { sidebarDataQuery } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";

const TITLE_SYSTEM_PROMPT = `
Generate a concise thread title that describes the conversation topic or intent.
Always produce a descriptive title — never repeat or lightly rephrase the user's message.
For greetings or small talk, summarize the kind of exchange (e.g. "hello" → Greeting, "how are you" → Checking In).
Return only the title.
Do not use quotation marks.
Use title case only when it reads naturally.
Keep it under 8 words.`;

const sanitizeTitle = (value: string) => {
  const title = value
    .trim()
    .replaceAll(/^["'`]+|["'`]+$/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();

  if (title.length > 0) {
    return title;
  }

  return null;
};

const createThreadTitleSchema = v.object({
  threadId: v.pipe(v.string(), v.nonEmpty()),
  text: v.pipe(v.string(), v.nonEmpty()),
});

export const createThreadTitle = createServerFn({ method: "POST" })
  .inputValidator(createThreadTitleSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    const memoryStore = await getMemoryStore();
    const { messages } = await memoryStore.listMessages({
      page: 0,
      perPage: 1,
      threadId: context.thread.id,
    });

    const userMessages = messages
      .slice(0, 10)
      .filter((message) => message.role === "user");

    if (userMessages.length > 1) {
      return null;
    }

    const { text } = await generateText({
      maxOutputTokens: 24,
      model: gateway.languageModel(models.threadTitle),
      prompt: data.text,
      system: TITLE_SYSTEM_PROMPT,
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

export const useCreateThreadTitle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: v.InferInput<typeof createThreadTitleSchema>) =>
      createThreadTitle({ data }),
    onSuccess: (thread) => {
      if (thread === null) {
        return;
      }

      queryClient.setQueryData(sidebarDataQuery.queryKey, (sidebarData) => {
        if (sidebarData === undefined) {
          return sidebarData;
        }

        return {
          conversations: sidebarData.conversations.map((conversation) =>
            conversation.id === thread.id
              ? {
                  ...conversation,
                  title: thread.title,
                  updatedAt: thread.updatedAt,
                }
              : conversation
          ),
          topics: sidebarData.topics.map((topic) => ({
            ...topic,
            threads: topic.threads.map((topicThread) =>
              topicThread.id === thread.id
                ? {
                    ...topicThread,
                    title: thread.title,
                    updatedAt: thread.updatedAt,
                  }
                : topicThread
            ),
          })),
        };
      });
    },
    onError: (error: unknown) => {
      console.error("error", error);
    },
  });
};
