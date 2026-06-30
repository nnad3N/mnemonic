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
    "Query a topic's artifacts and conversation history via the topic agent.",
    "Use when the user wants information from a specific topic, its files, or prior topic conversations.",
    "Pass topicId as the topic's ID only — when the user @-mentions a topic, the mention key is topic::{ID}; pass just {ID}, not the prefix, title, thread ID, or artifact ID.",
    "If the topic to use is unclear, ask the user before calling.",
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
