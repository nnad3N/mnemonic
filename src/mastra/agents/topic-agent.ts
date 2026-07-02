import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import {
  baseInstructions,
  sharedSourceInstructions,
} from "@/mastra/agents/base-instructions";
import { models } from "@/mastra/models";
import { pgVector, postgresStore } from "@/mastra/storage";
import { getResourceFromS3Tool } from "@/mastra/tools/get-resource-from-s3-tool";
import { resourceGraphRagTool } from "@/mastra/tools/resource-graph-rag-tool";
import { resourceVectorSearchTool } from "@/mastra/tools/resource-vector-search-tool";
import { webSearchTool } from "@/mastra/tools/web-search-tool";

export const topicAgentId = "topic-agent";

export const topicMemory = new Memory({
  embedder: models.embedding,
  options: {
    observationalMemory: {
      model: models.observationalMemory,
      retrieval: {
        scope: "resource",
        vector: true,
      },
      scope: "thread",
      temporalMarkers: true,
    },
  },
  storage: postgresStore,
  vector: pgVector,
});

export const topicAgentTools = {
  "resource-graph-rag": resourceGraphRagTool,
  "resource-vector-search": resourceVectorSearchTool,
  "get-resource-from-s3": getResourceFromS3Tool,
  "web-search": webSearchTool,
} as const;

export const topicAgent = new Agent({
  description:
    "Uses current topic resources, topic-scoped conversation recall, raw topic file access, and web search to answer topic-specific questions.",
  id: topicAgentId,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Available sources:
- Topic resources: uploaded files in the current topic. Prefer these for questions about the user's documents.
- Web search: external or current information. Use when the question needs facts outside the topic or up-to-date information from the web.
- Conversation recall: past messages within the current topic. Use when the answer may already appear in prior chat.

When sources conflict, prefer topic resources over web search, and web search over conversation recall.

## Web search
Use web-search when:
- The user asks for current events, external documentation, or explicitly wants a web search.
- Topic resource tools plus conversation recall did not fully answer the question.

## Topic file access
When gathering from topic resources, pick the tool that fits the question. You do not need to run every resource tool.

- resource-vector-search — Direct facts, quotes, or specific passages in uploaded documents.
- resource-graph-rag — When information spans multiple files, connected passages matter, or relationships between concepts are important.
- get-resource-from-s3 — Raw file inspection for images, or fallback direct inspection when search tools are insufficient.

Search tools are automatically scoped to the current topic. Tool descriptions own exact input requirements and file-type limits.

## Conversation history
Use recall to browse past messages within the current topic:
- mode "threads" — list thread IDs and titles under the current topic.
- mode "messages" with threadId — read messages from a specific thread in the current topic.
- mode "search" with query — find relevant messages across threads in the current topic.
Threads from other topics or standalone conversations are not accessible.
`,
  memory: topicMemory,
  model: models.topicAgent,
  name: "Topic",
  tools: topicAgentTools,
});
