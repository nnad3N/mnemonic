import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { Result } from "better-result";
import { nanoid } from "nanoid";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { Kit } from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { topicAgent } from "@/mastra/agents/topic-agent";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";
import type { MnemonicRequestContext } from "@/mastra/request-context";

const inputSchema = v.object({
  topicId: v.pipe(
    v.string(),
    v.nanoid(),
    v.description(
      "Bare topic ID only. For a mention key like topic::{ID}, pass only {ID} — not the prefix, title, thread ID, or Mastra resource ID.",
    ),
  ),
  prompt: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description("Question or instruction for the topic agent to answer from that topic."),
  ),
});

const successOutputSchema = v.object({
  type: v.literal("success"),
  answer: v.pipe(v.string(), v.nonEmpty()),
});

const errorOutputSchema = v.object({
  type: v.literal("error"),
  message: v.string(),
});

const outputSchema = v.variant("type", [successOutputSchema, errorOutputSchema]);

type AccessTopicSuccess = v.InferOutput<typeof successOutputSchema>;
type AccessTopicError = v.InferOutput<typeof errorOutputSchema>;

type AccessTopicInput = {
  topicId: string;
  prompt: string;
  userId?: SafeId<"user">;
};

type AccessTopicCtx = Kits<[DbKit]>;

const accessTopicFn = Kit.gen(async function* (ctx: AccessTopicCtx, input: AccessTopicInput) {
  if (!input.userId) {
    return Result.ok({
      type: "error",
      message: "Topic not found.",
    } satisfies AccessTopicError);
  }

  const ownedTopic = yield* await ctx.db.run((db) =>
    db.query.topic.findFirst({
      columns: { id: true, userId: true },
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
        id: toSafeId<"topic">(input.topicId),
        userId: input.userId,
      },
    }),
  );

  if (!ownedTopic) {
    return Result.ok({
      type: "error",
      message: "Topic not found.",
    } satisfies AccessTopicError);
  }

  const topicRequestContext = new RequestContext<MnemonicRequestContext>();

  topicRequestContext.set("userId", ownedTopic.userId);
  topicRequestContext.set("filter", { topicId: ownedTopic.id });

  const result = yield* await Result.tryPromise(async () =>
    topicAgent.generate(input.prompt, {
      maxSteps: 10,
      memory: {
        resource: ownedTopic.id,
        thread: nanoid(),
      },
      requestContext: topicRequestContext,
    }),
  );
  const answer = result.text.trim();

  if (!answer) {
    return Result.ok({
      type: "error",
      message: "The topic agent did not return an answer.",
    } satisfies AccessTopicError);
  }

  return Result.ok({
    type: "success",
    answer,
  } satisfies AccessTopicSuccess);
});

const accessTopicCtx = Kit.createContext(dbKit);

export const accessTopicTool = createTool({
  id: "access-topic",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Ask the topic agent to answer from one specific topic's files and topic-scoped conversation history.",
    "Use when the user names, @-mentions, or otherwise clearly identifies a topic and wants information from that topic, its files, or prior topic conversations.",
    "Do not use for general web research, the current standalone conversation, or an unclear topic; ask which topic to use before calling.",
    "Returns a synthesized answer from the topic agent, not raw file contents. On failure, returns a safe error the caller can explain or recover from.",
  ].join(" "),
  execute: async ({ topicId, prompt }, context) => {
    const result = await accessTopicFn(accessTopicCtx, {
      topicId,
      prompt,
      userId: context.requestContext?.get("userId"),
    });

    if (Result.isError(result)) {
      return {
        type: "error",
        message: "The topic could not be accessed.",
      } satisfies AccessTopicError;
    }

    return result.value;
  },
});
