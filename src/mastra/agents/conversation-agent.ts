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
import { getFileTool } from "@/mastra/tools/get-file-tool";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool";
import { webSearchTool } from "@/mastra/tools/web-search-tool";

export const CONVERSATION_AGENT_ID = "conversation-agent";

export const conversationMemory = new Memory({
  embedder: models.embedding,
  options: {
    observationalMemory: observationalMemoryOptions({
      scope: "thread",
      vector: true,
    }),
  },
  storage: libsqlStore,
  vector: libsqlVector,
});

const conversationAgentTools = {
  docs: docsTool,
  executeCode: executeCodeTool,
  getFile: getFileTool,
  webFetch: webFetchTool,
  webSearch: webSearchTool,
} as const;

export type ConversationAgentTools = typeof conversationAgentTools;

export const conversationAgent = new Agent({
  id: CONVERSATION_AGENT_ID,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Available sources:
- Conversation recall: past messages in the current conversation only. Prefer this when the answer may already appear in prior chat.
- Referenced files: content the user has pointed at in this conversation.
- Web: current or external information. Prefer it when the question needs facts from outside this conversation or up-to-date information, or when conversation recall did not fully answer.

${sharedWebResearchInstructions}

## Conversation history
Use recall to browse past messages in the current conversation only:
- mode "messages" — read messages from the current thread.
- mode "search" with query — find relevant messages in the current thread.
`,
  agents: { webResearch: webResearchAgent },
  inputProcessors: [stripNonNativeFilePartsProcessor],
  outputProcessors: [workSegmentTimingProcessor],
  memory: conversationMemory,
  requestContextSchema: mnemonicRequestContextSchema,
  model: getAgentModel,
  name: "Conversation",
  tools: conversationAgentTools,
});
