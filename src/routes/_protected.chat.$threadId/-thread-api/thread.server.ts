import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import type { TsrSerializable } from "@tanstack/router-core";
import { generateText } from "ai";
import { Result } from "better-result";
import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import { file, threadSettings, topic } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit.server";
import type { S3Kit } from "@/lib/s3-kit.server";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import type { VectorKit } from "@/lib/vector-kit.server";
import { getThreadTitleModel } from "@/mastra/models.server";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";

type CreateTopicCtx = Kits<[DbKit, MemoryKit]>;

type CreateTopicInput = {
  conversationTitle: string;
  title: string;
  userId: SafeId<"user">;
};

export const createTopicFn = Kit.gen(async function* (
  ctx: CreateTopicCtx,
  input: CreateTopicInput,
) {
  const topicId = createSafeId<"topic">();

  yield* await ctx.db.run((db) =>
    db.insert(topic).values({
      id: topicId,
      title: input.title,
      userId: input.userId,
    }),
  );

  const now = new Date();
  const thread = yield* await ctx.memory.saveThread({
    thread: {
      id: nanoid(),
      resourceId: topicId,
      title: input.conversationTitle,
      createdAt: now,
      updatedAt: now,
    },
  });

  return Result.ok({ topicId, threadId: thread.id });
});

type DeleteThreadCtx = Kits<[DbKit, S3Kit, MemoryKit, VectorKit]>;

type DeleteTopicInput = {
  topicId: SafeId<"topic">;
};

export const deleteTopicFn = Kit.gen(async function* (
  ctx: DeleteThreadCtx,
  input: DeleteTopicInput,
) {
  const [files, { threads }] = yield* await Kit.promiseAll([
    ctx.db.run((db) =>
      db.query.file.findMany({
        where: { topicId: input.topicId },
        columns: { s3Key: true },
      }),
    ),
    ctx.memory.listThreads({
      filter: { resourceId: input.topicId },
      page: 0,
      perPage: false,
    }),
  ]);
  yield* await Kit.promiseAll([
    ctx.s3.deleteObjects({
      keys: files.map((row) => row.s3Key),
    }),
    ctx.vector.deleteVectors({
      filter: { topicId: input.topicId },
    }),
    ctx.memory.clearResourceObservations({ resourceId: input.topicId }),
    ...threads.map(async (thread) => ctx.memory.deleteThread({ threadId: thread.id })),
  ]);
  // Keep durable rows until external deletes succeed so a failed S3/vector/memory
  // call can be retried.
  yield* await ctx.db.transaction(async (tx) =>
    Promise.all([
      tx.delete(file).where(eq(file.topicId, input.topicId)),
      tx.delete(threadSettings).where(
        inArray(
          threadSettings.threadId,
          threads.map((thread) => thread.id),
        ),
      ),
      tx.delete(topic).where(eq(topic.id, input.topicId)),
    ]),
  );

  return Result.ok({ id: input.topicId });
});

type DeleteConversationCtx = Kits<[DbKit, MemoryKit]>;

type DeleteConversationInput = {
  threadId: string;
};

export const deleteConversationFn = Kit.gen(async function* (
  ctx: DeleteConversationCtx,
  input: DeleteConversationInput,
) {
  yield* await ctx.memory.deleteThread({
    threadId: input.threadId,
  });

  yield* await ctx.db.run((db) =>
    db.delete(threadSettings).where(eq(threadSettings.threadId, input.threadId)),
  );

  return Result.ok({ id: input.threadId });
});

type GetThreadCtx = Kits<[DbKit, MemoryKit]>;

type GetThreadInput = {
  resourceId: string;
  threadId: string;
  userId: SafeId<"user">;
};

// Collapse Mastra's split assistants so the UI always sees user → assistant → user.
export const mergeConsecutiveAssistantMessages = <TMessage extends ThreadUIMessage>(
  messages: TMessage[],
): TMessage[] => {
  const merged: TMessage[] = [];

  for (const message of messages) {
    const previous = merged.at(-1);
    if (message.role === "assistant" && previous?.role === "assistant") {
      merged[merged.length - 1] = {
        ...message,
        parts: previous.parts.concat(message.parts),
      };
      continue;
    }
    merged.push(message);
  }

  return merged;
};

export const getThreadFn = Kit.gen(async function* (ctx: GetThreadCtx, input: GetThreadInput) {
  const [{ messages }, topic] = yield* await Kit.promiseAll([
    ctx.memory.listMessages({
      threadId: input.threadId,
      page: 0,
      perPage: false,
    }),
    ctx.db.run((db) =>
      db.query.topic.findFirst({
        columns: { id: true },
        where: {
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
          id: toSafeId<"topic">(input.resourceId),
          userId: input.userId,
        },
      }),
    ),
  ]);

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const uiMessages = toAISdkMessages(messages, {
    version: "v6",
  }) as (ThreadUIMessage & TsrSerializable)[];

  return Result.ok({
    messages: mergeConsecutiveAssistantMessages(uiMessages),
    resourceId: input.resourceId,
    topicId: topic?.id,
  });
});

const TITLE_INSTRUCTIONS = `
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

type CreateThreadTitleCtx = Kits<[MemoryKit]>;

type CreateThreadTitleInput = {
  apiKey: string;
  metadata: Record<string, unknown>;
  text: string;
  threadId: string;
};

export const createThreadTitleFn = Kit.gen(async function* (
  ctx: CreateThreadTitleCtx,
  input: CreateThreadTitleInput,
) {
  const text = yield* await Result.tryPromise(
    {
      try: async () => {
        const result = await generateText({
          abortSignal: AbortSignal.timeout(TITLE_GENERATION_TIMEOUT_MS),
          model: getThreadTitleModel(input.apiKey),
          prompt: input.text,
          providerOptions: {
            openrouter: {
              reasoning: {
                effort: "none",
              },
            },
          },
          instructions: TITLE_INSTRUCTIONS,
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
