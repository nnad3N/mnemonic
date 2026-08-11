import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { matchError, Result } from "better-result";
import { produce } from "immer";
import * as v from "valibot";

import { ServerFnError, toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { models } from "@/mastra/models";
import { sidebarThreadsQuery } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";

const TITLE_SYSTEM_PROMPT = `
You generate concise thread titles for a conversation sidebar.

Rules:
- Return only one title.
- Use 2 to 7 words unless a one-word title is clearly best.
- Describe the topic or intent; do not simply repeat or lightly rephrase the user's message.
- For greetings or small talk, summarize the exchange type, such as Greeting or Checking In.
- Use natural title case, without quotation marks or trailing punctuation.
- Avoid vague titles like Help, Question, or New Chat.`;

const MAX_TITLE_LENGTH = 255;
const TITLE_GENERATION_TIMEOUT_MS = 10_000;

export const sanitizeTitle = (value: string) => {
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

type CreateThreadTitleCtx = Kits<[MemoryKit]>;

type CreateThreadTitleInput = {
  metadata: Record<string, unknown>;
  text: string;
  threadId: string;
};

const createThreadTitleFn = Kit.gen(async function* (
  ctx: CreateThreadTitleCtx,
  input: CreateThreadTitleInput,
) {
  const text = yield* await Result.tryPromise(
    {
      try: async () => {
        const result = await generateText({
          abortSignal: AbortSignal.timeout(TITLE_GENERATION_TIMEOUT_MS),
          model: models.threadTitle,
          prompt: input.text,
          providerOptions: {
            openrouter: {
              reasoning: {
                effort: "none",
              },
            },
          },
          system: TITLE_SYSTEM_PROMPT,
        });

        return result.text;
      },
      catch: () => toServerFnError.serverError("Failed to generate conversation title"),
    },
    {
      retry: {
        times: 3,
        delayMs: 500,
        backoff: "exponential",
      },
    },
  );

  const title = sanitizeTitle(text);

  if (!title) {
    return Result.ok(null);
  }

  const thread = yield* await ctx.memory.updateThread({
    id: input.threadId,
    metadata: input.metadata,
    title,
  });

  return Result.ok({
    id: thread.id,
    title,
    updatedAt: thread.updatedAt.toISOString(),
  });
});

const createThreadTitleCtx = Kit.createContext(memoryKit);

export const createThreadTitle = createServerFn({ method: "POST" })
  .validator(createThreadTitleSchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      createThreadTitleFn(createThreadTitleCtx, {
        metadata: context.thread.metadata ?? {},
        text: data.text,
        threadId: context.thread.id,
      }),
    ).throws<ServerFnError>((error) => {
      if (ServerFnError.is(error)) {
        return error;
      }

      return matchError(error, {
        MemoryError: () => toServerFnError.serverError("Failed to save conversation title"),
      });
    }),
  );

type CreateThreadTitleVars = {
  threadId: string;
  text: string;
  topicId?: string;
};

export const useCreateThreadTitle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateThreadTitleVars) => createThreadTitle({ data }),
    onSuccess: (thread, vars) => {
      if (!thread) return;

      queryClient.setQueryData(sidebarThreadsQuery(vars.topicId).queryKey, (current) =>
        produce(current, (draft) => {
          if (!draft) return;

          for (const item of draft) {
            if (item.id === thread.id) {
              item.title = thread.title;
              item.updatedAt = thread.updatedAt;
            }
          }
        }),
      );
    },
  });
};
