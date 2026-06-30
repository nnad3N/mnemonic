import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { baseInstructions } from "@/mastra/agents/base-instructions";
import { models } from "@/mastra/models";
import { pgVector, postgresStore } from "@/mastra/storage";
import { accessTopicTool } from "@/mastra/tools/access-topic-tool";
import { webSearchTool } from "@/mastra/tools/web-search-tool";

export const conversationAgentId = "conversation-agent";

export const conversationMemory = new Memory({
  embedder: models.embedding,
  options: {
    observationalMemory: {
      model: models.observationalMemory,
      retrieval: {
        scope: "thread",
        vector: true,
      },
      scope: "thread",
      temporalMarkers: true,
    },
  },
  storage: postgresStore,
  vector: pgVector,
});

export const conversationAgentTools = {
  "access-topic": accessTopicTool,
  "web-search": webSearchTool,
} as const;

export const conversationAgent = new Agent({
  id: conversationAgentId,
  instructions: `
${baseInstructions}

## Choosing sources
When the user does not specify where information should come from, use the source(s) that best fit the question. You do not need to consult every source — reach for another only when what you tried is insufficient.

- Conversation recall — past messages in the current conversation only. Prefer this when the answer may already appear in prior chat.
- Web search — current or external information. Use when the question needs facts outside this conversation or up-to-date from the web.
- Access topic — use access-topic when the user asks to pull information from a topic, its files, or its prior conversations.

When the user explicitly limits the source, use only that source unless it cannot answer the question.

## Access topic
Use access-topic when:
- The user asks for information from a topic, topic files, topic artifacts, or prior topic conversations.
- Conversation recall and web search are not the right source because the answer should come from topic-owned context.


## Web search
Use web-search when:
- The user asks for current events, external documentation, or explicitly wants a web search.
- Conversation recall did not fully answer the question and topic context is not required.

## Conversation history
Use recall to browse past messages in the current conversation only:
- mode "messages" — read messages from the current thread.
- mode "search" with query — find relevant messages in the current thread.
`,
  memory: conversationMemory,
  model: models.conversationAgent,
  name: "Conversation",
  tools: conversationAgentTools,
});
