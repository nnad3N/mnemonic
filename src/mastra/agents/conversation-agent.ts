import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { baseInstructions, sharedSourceInstructions } from "@/mastra/agents/base-instructions";
import { models } from "@/mastra/models";
import { libsqlStore, libsqlVector } from "@/mastra/storage";
import { accessTopicTool } from "@/mastra/tools/access-topic-tool";
import { executeCodeTool } from "@/mastra/tools/execute-code-tool";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool";
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
  storage: libsqlStore,
  vector: libsqlVector,
});

export const conversationAgentTools = {
  accessTopic: accessTopicTool,
  executeCode: executeCodeTool,
  webFetch: webFetchTool,
  webSearch: webSearchTool,
} as const;

export const conversationAgent = new Agent({
  id: conversationAgentId,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Available sources:
- Conversation recall: past messages in the current conversation only. Prefer this when the answer may already appear in prior chat.
- Web: current or external information via webSearch (discover pages) or webFetch (read a known URL).
- Access topic: topic files and topic-scoped conversation history. Use when the user asks for information from a topic, topic files, or prior topic conversations.
- Code execution: run JavaScript in an isolated sandbox via executeCode for calculations, parsing, data transforms, or HTTPS API reads.

## Access topic
Use accessTopic only when the topic is clear. If the user asks about a topic but no topic can be identified, ask which topic to use.

## Web
- Use webSearch to discover pages when no specific URL is known.
- Use webFetch when the user provided a URL or a prior search already identified the page to read.
- Prefer these when the question needs facts outside this conversation or up-to-date information from the web, or when conversation recall did not fully answer and topic context is not required.
- Tool descriptions own exact input requirements and result shapes.

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
