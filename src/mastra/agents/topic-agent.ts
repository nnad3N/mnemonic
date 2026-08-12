import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import {
  baseInstructions,
  sharedSourceInstructions,
  sharedWebResearchInstructions,
} from "@/mastra/agents/base-instructions";
import { webResearchAgent } from "@/mastra/agents/web-research-agent";
import { getAgentModel, models, observationalMemoryOptions } from "@/mastra/models";
import { stripNonNativeFilePartsProcessor } from "@/mastra/processors/strip-non-native-file-parts";
import { workSegmentTimingProcessor } from "@/mastra/processors/work-segment-timing";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";
import { libsqlStore, libsqlVector } from "@/mastra/storage";
import { docsTool } from "@/mastra/tools/docs-tool";
import { executeCodeTool } from "@/mastra/tools/execute-code-tool";
import { fileGraphRagTool } from "@/mastra/tools/file-graph-rag-tool";
import { fileVectorSearchTool } from "@/mastra/tools/file-vector-search-tool";
import { getFileTool } from "@/mastra/tools/get-file-tool";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool";
import { webSearchTool } from "@/mastra/tools/web-search-tool";

export const TOPIC_AGENT_ID = "topic-agent";

export const topicMemory = new Memory({
  embedder: models.embedding,
  options: {
    observationalMemory: observationalMemoryOptions({
      scope: "resource",
      vector: true,
    }),
  },
  storage: libsqlStore,
  vector: libsqlVector,
});

const topicAgentTools = {
  docs: docsTool,
  executeCode: executeCodeTool,
  fileGraphRag: fileGraphRagTool,
  fileVectorSearch: fileVectorSearchTool,
  getFile: getFileTool,
  webFetch: webFetchTool,
  webSearch: webSearchTool,
} as const;

export type TopicAgentTools = typeof topicAgentTools;

export const topicAgent = new Agent({
  description:
    "Uses current topic files, topic-scoped conversation recall, raw topic file access, and web search/fetch to answer topic-specific questions.",
  id: TOPIC_AGENT_ID,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Available sources:
- Topic files: uploaded files in the current topic. Prefer these for questions about the user's documents.
- Web: external or current information via webSearch (discover pages) or webFetch (read a known URL).
- Conversation recall: past messages within the current topic. Use when the answer may already appear in prior chat.

When sources conflict, prefer topic files over web, and web over conversation recall.

Prefer the web for current events, external documentation, explicit web requests, or when topic files plus conversation recall did not fully answer.

When gathering from topic files, pick the tool that fits the question. You do not need to run every file tool.

${sharedWebResearchInstructions}

## Conversation history
Use recall to browse past messages within the current topic:
- mode "threads" — list thread IDs and titles under the current topic.
- mode "messages" with threadId — read messages from a specific thread in the current topic.
- mode "search" with query — find relevant messages across threads in the current topic.
Threads from other topics or standalone conversations are not accessible.
`,
  agents: { webResearch: webResearchAgent },
  inputProcessors: [stripNonNativeFilePartsProcessor],
  outputProcessors: [workSegmentTimingProcessor],
  memory: topicMemory,
  requestContextSchema: mnemonicRequestContextSchema,
  model: getAgentModel,
  name: "Topic",
  tools: topicAgentTools,
});
