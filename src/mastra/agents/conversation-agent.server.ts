import { Agent } from "@mastra/core/agent";

import { getAgentMemory } from "@/mastra/agent-memory.server";
import {
  baseInstructions,
  sharedDelegationInstructions,
  sharedSourceInstructions,
} from "@/mastra/agents/base-instructions.server";
import { readerAgent } from "@/mastra/agents/reader-agent.server";
import { getAgentModel } from "@/mastra/models.server";
import { stripNonNativeFilePartsProcessor } from "@/mastra/processors/strip-non-native-file-parts.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { calculateDocsTool } from "@/mastra/tools/calculate-docs-tool.server";
import { calculateTool } from "@/mastra/tools/calculate-tool.server";
import { searchFileTool } from "@/mastra/tools/search-file-tool.server";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool.server";
import { webSearchTool } from "@/mastra/tools/web-search-tool.server";

export const CONVERSATION_AGENT_ID = "conversation-agent";

const conversationAgentTools = {
  calculate: calculateTool,
  calculateDocs: calculateDocsTool,
  searchFile: searchFileTool,
  webFetch: webFetchTool,
  webSearch: webSearchTool,
} as const;

export type ConversationAgentTools = typeof conversationAgentTools;

export const conversationAgent = new Agent({
  id: CONVERSATION_AGENT_ID,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Sources: files attached in this conversation, web (external or current facts; use when recall did not answer).
Files: read only via delegation. Whether/where a file mentions something → file search yourself.

${sharedDelegationInstructions}
`,
  agents: { reader: readerAgent },
  durable: true,
  inputProcessors: [stripNonNativeFilePartsProcessor],
  memory: getAgentMemory("thread"),
  requestContextSchema: mnemonicRequestContextSchema,
  model: getAgentModel,
  name: "Conversation",
  tools: conversationAgentTools,
});
