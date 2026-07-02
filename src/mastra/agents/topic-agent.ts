import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import {
  baseInstructions,
  sharedSourceInstructions,
} from "@/mastra/agents/base-instructions";
import { models } from "@/mastra/models";
import { pgVector, postgresStore } from "@/mastra/storage";
import { fileGraphRagTool } from "@/mastra/tools/file-graph-rag-tool";
import { fileVectorSearchTool } from "@/mastra/tools/file-vector-search-tool";
import { getFileFromS3Tool } from "@/mastra/tools/get-file-from-s3-tool";
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
  fileGraphRag: fileGraphRagTool,
  fileVectorSearch: fileVectorSearchTool,
  getFileFromS3: getFileFromS3Tool,
  webSearch: webSearchTool,
} as const;

export const topicAgent = new Agent({
  description:
    "Uses current topic files, topic-scoped conversation recall, raw topic file access, and web search to answer topic-specific questions.",
  id: topicAgentId,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Available sources:
- Topic files: uploaded files in the current topic. Prefer these for questions about the user's documents.
- Web search: external or current information. Use when the question needs facts outside the topic or up-to-date information from the web.
- Conversation recall: past messages within the current topic. Use when the answer may already appear in prior chat.

When sources conflict, prefer topic files over web search, and web search over conversation recall.

## Web search
Use webSearch when:
- The user asks for current events, external documentation, or explicitly wants a web search.
- Topic file tools plus conversation recall did not fully answer the question.

## Topic file access
When gathering from topic files, pick the tool that fits the question. You do not need to run every file tool.

- fileVectorSearch — Direct facts, quotes, or specific passages in uploaded documents.
- fileGraphRag — When information spans multiple files, connected passages matter, or relationships between concepts are important.
- getFileFromS3 — Raw file inspection for images, or fallback direct inspection when search tools are insufficient.

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
