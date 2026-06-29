import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { baseInstructions } from "@/mastra/agents/base-instructions";
import { models } from "@/mastra/models";
import { pgVector, postgresStore } from "@/mastra/storage";
import { artifactGraphRagTool } from "@/mastra/tools/artifact-graph-rag-tool";
import { artifactVectorSearchTool } from "@/mastra/tools/artifact-vector-search-tool";
import { getArtifactFromS3Tool } from "@/mastra/tools/get-artifact-from-s3-tool";
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
  "artifact-graph-rag": artifactGraphRagTool,
  "artifact-vector-search": artifactVectorSearchTool,
  "get-artifact-from-s3": getArtifactFromS3Tool,
  "web-search": webSearchTool,
} as const;

export const topicAgent = new Agent({
  description:
    "Uses current topic artifacts, topic-scoped conversation recall, raw topic file access, and web search to answer topic-specific questions.",
  id: topicAgentId,
  instructions: `
${baseInstructions}

## Choosing sources
When the user does not specify where information should come from, use the source(s) that best fit the question. You do not need to consult every source — reach for another only when what you tried is insufficient.

- Topic artifacts — uploaded files in the current topic (vector search, graph RAG, S3). Prefer these for questions about the user's documents.
- Web search — external or current information. Use when the question needs facts outside the topic or up-to-date from the web.
- Conversation recall — past messages within the current topic. Use when the answer may already appear in prior chat.

When the user explicitly limits the source (e.g. "only from my files", "search the web"), use only that source unless it cannot answer the question.

When sources conflict, prefer topic artifacts over web search, and web search over conversation recall.

## Web search
Use web-search when:
- The user asks for current events, external documentation, or explicitly wants a web search.
- Topic artifact tools plus conversation recall did not fully answer the question.

## Topic file access
When gathering from topic artifacts, pick the tool that fits the question. You do not need to run every artifact tool — try another only when the one you used is insufficient.

- artifact-vector-search — Direct facts, quotes, or specific passages in uploaded documents.
- artifact-graph-rag — When information spans multiple files, connected passages matter, or relationships between concepts are important.
- get-artifact-from-s3 — Load the raw file for direct inspection:
  - Always use for images. Uploaded images are not text-indexed; S3 is the only source.
  - Use for LLM-native file types when search tools are insufficient or the user @-mentions a specific file (pass its artifactId).
  - Only works for LLM-native file types. For office documents and other extracted-only formats, rely on the search tools instead.

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
