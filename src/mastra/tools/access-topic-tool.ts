import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { nanoid } from "nanoid";
import * as v from "valibot";

import { db } from "@/db";
import { topicAgent } from "@/mastra/agents/topic-agent";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";
import type { MnemonicRequestContext } from "@/mastra/request-context";

const inputSchema = v.object({
  topicId: v.pipe(v.string(), v.nanoid()),
  prompt: v.pipe(v.string(), v.nonEmpty()),
});

const outputSchema = v.object({
  answer: v.pipe(v.string(), v.nonEmpty()),
});

export const accessTopicTool = createTool({
  id: "access-topic",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: [
    "Ask the topic agent to answer from one specific topic's artifacts and topic-scoped conversation history.",
    "Use when the user names, @-mentions, or otherwise clearly identifies a topic and wants information from that topic, its files, or prior topic conversations.",
    "Do not use for general web research, the current standalone conversation, or an unclear topic; ask which topic to use before calling.",
    "Input topicId must be the bare topic ID. For a mention key like topic::{ID}, pass only {ID}, not the prefix, title, thread ID, or artifact ID.",
    "Returns a synthesized answer from the topic agent, not raw file contents.",
  ].join(" "),
  execute: async ({ topicId, prompt }, context) => {
    const userId = context.requestContext?.get("userId");

    if (!userId) {
      throw new Error("Topic not found.");
    }

    const ownedTopic = await db.query.topic.findFirst({
      columns: { id: true },
      where: {
        id: topicId,
        userId,
      },
    });

    if (!ownedTopic) {
      throw new Error("Topic not found.");
    }

    const topicRequestContext = new RequestContext<MnemonicRequestContext>();
    topicRequestContext.set("userId", userId);
    topicRequestContext.set("filter", { topicId: ownedTopic.id });

    const result = await topicAgent.generate(prompt, {
      maxSteps: 10,
      memory: {
        resource: ownedTopic.id,
        thread: nanoid(),
      },
      requestContext: topicRequestContext,
    });

    return { answer: result.text };
  },
});
