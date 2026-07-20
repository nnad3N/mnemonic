import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { baseInstructions, sharedSourceInstructions } from "@/mastra/agents/base-instructions";
import { models } from "@/mastra/models";
import { libsqlStore, libsqlVector } from "@/mastra/storage";
import { executeCodeTool } from "@/mastra/tools/execute-code-tool";
import { fileGraphRagTool } from "@/mastra/tools/file-graph-rag-tool";
import { fileVectorSearchTool } from "@/mastra/tools/file-vector-search-tool";
import { getFileFromS3Tool } from "@/mastra/tools/get-file-from-s3-tool";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool";
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
  storage: libsqlStore,
  vector: libsqlVector,
});

export const topicAgentTools = {
  executeCode: executeCodeTool,
  fileGraphRag: fileGraphRagTool,
  fileVectorSearch: fileVectorSearchTool,
  getFileFromS3: getFileFromS3Tool,
  webFetch: webFetchTool,
  webSearch: webSearchTool,
} as const;

export const topicAgent = new Agent({
  description:
    "Uses current topic files, topic-scoped conversation recall, raw topic file access, and web search/fetch to answer topic-specific questions.",
  id: topicAgentId,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Available sources:
- Topic files: uploaded files in the current topic. Prefer these for questions about the user's documents.
- Web: external or current information via webSearch (discover pages) or webFetch (read a known URL).
- Conversation recall: past messages within the current topic. Use when the answer may already appear in prior chat.
- Code execution: run JavaScript in an isolated sandbox via executeCode for calculations (including bundled mathjs), parsing, data transforms, or HTTPS API reads.

When sources conflict, prefer topic files over web, and web over conversation recall.

## Web
- Use webSearch to discover pages when no specific URL is known.
- Use webFetch when the user provided a URL or a prior search already identified the page to read.
- Prefer these for current events, external documentation, explicit web requests, or when topic file tools plus conversation recall did not fully answer.
- Tool descriptions own exact input requirements and result shapes.

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
