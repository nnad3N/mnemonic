import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { baseInstructions } from "@/mastra/agents/base-instructions";
import { google } from "@/mastra/google";
import { models } from "@/mastra/models";
import { pgVector, postgresStore } from "@/mastra/storage";
import { artifactGraphRagTool } from "@/mastra/tools/artifact-graph-rag-tool";
import { artifactVectorSearchTool } from "@/mastra/tools/artifact-vector-search-tool";
import { getArtifactFromS3Tool } from "@/mastra/tools/get-artifact-from-s3-tool";

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
  "artifact-graph-rag": artifactGraphRagTool,
  "artifact-vector-search": artifactVectorSearchTool,
  "get-artifact-from-s3": getArtifactFromS3Tool,
  "web-search": google.tools.googleSearch({
    needsApproval: false,
  }),
} as const;

export const topicAgent = new Agent({
  description:
    "Uses current topic artifacts, topic-scoped conversation recall, raw topic file access, and web search to answer topic-specific questions.",
  id: topicAgentId,
  instructions: `
${baseInstructions}

## Source hierarchy
When the user does not specify where information should come from, gather data from every available source before answering. Work through sources in this order — continue to the next when earlier sources did not fully answer the question:

1. Topic artifacts — uploaded files in the current topic (vector search, graph RAG, S3).
2. Web search — external or current information.
3. Conversation recall — past messages within the current topic.

When the user explicitly limits the source (e.g. "only from my files", "search the web"), use only that source unless it cannot answer the question.

When sources conflict, prefer evidence from higher-priority sources.

## Web search
Use web-search when:
- The user asks for current events, external documentation, or explicitly wants a web search.
- Topic artifact tools plus conversation recall did not fully answer the question.

## Topic file access
When gathering from topic artifacts — including when the user did not specify a source — use these tools in order:

1. artifact-vector-search — Default first step. Use for direct facts, quotes, or specific passages in uploaded documents.
2. artifact-graph-rag — Use when vector search is insufficient: information spans multiple files, connected passages matter, or relationships between concepts are important.
3. get-artifact-from-s3 — Load the raw file for direct inspection:
   - Always use for images. Uploaded images are not text-indexed; S3 is the only source.
   - Use as a fallback when vector or graph search did not answer the question.
   - Only works for LLM-native file types. For office documents and other extracted-only formats, rely on the search tools instead.
   - Pass the artifactId from @-mentions when the user references a specific file.

Search tools are automatically scoped to the current topic. Do not call get-artifact-from-s3 for file types it cannot load.

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
