import { Agent } from "@mastra/core/agent";

import { getAgentMemory } from "@/mastra/agent-memory.server";
import { baseInstructions } from "@/mastra/agents/base-instructions.server";
import { readerAgent } from "@/mastra/agents/reader-agent.server";
import { getThreadModel } from "@/mastra/config.server";
import { CONVERSATION_AGENT_ID } from "@/mastra/models.server";
import { hoistToolResultMediaProcessor } from "@/mastra/processors/hoist-tool-result-media.server";
import { pinSubagentSteps } from "@/mastra/processors/soft-stop.server";
import { stripFilePartsProcessor } from "@/mastra/processors/strip-file-parts.server";
import { stripGeminiReasoningProcessor } from "@/mastra/processors/strip-gemini-reasoning.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { computeDocsTool } from "@/mastra/tools/compute-docs-tool.server";
import { computeTool } from "@/mastra/tools/compute-tool.server";
import { createNoteTool } from "@/mastra/tools/create-note-tool.server";
import { readFileTool } from "@/mastra/tools/read-file-tool.server";
import { readNoteTool } from "@/mastra/tools/read-note-tool.server";
import { searchFileTool } from "@/mastra/tools/search-file-tool.server";
import { searchNotesTool } from "@/mastra/tools/search-notes-tool.server";
import { updateNoteTool } from "@/mastra/tools/update-note-tool.server";
import { userLinkWebFetchTool } from "@/mastra/tools/web-fetch-tool.server";
import { webSearchTool } from "@/mastra/tools/web-search-tool.server";

const conversationAgentTools = {
  compute: computeTool,
  computeDocs: computeDocsTool,
  readFile: readFileTool,
  readNote: readNoteTool,
  searchFile: searchFileTool,
  searchNotes: searchNotesTool,
  updateNote: updateNoteTool,
  webFetch: userLinkWebFetchTool,
  webSearch: webSearchTool,
  createNote: createNoteTool,
} as const;

export type ConversationAgentTools = typeof conversationAgentTools;

export const conversationAgent = new Agent({
  id: CONVERSATION_AGENT_ID,
  instructions: `
${baseInstructions}

Do yourself: search a file for whether or where it contains something. User gave one file -> work it yourself: search it, compute over it, read it whole only when task needs whole file. Anything else -> reader: second file, any page or file you found, however few.
Read you started turns out huge -> hand rest to reader, do not absorb whole.
Reader sees only your prompt, not conversation: exact question, output wanted, every URL and file mention key, user constraints.
Report answers its task; never redo its work to check it. Part unanswered -> delegate remainder or tell user what is missing.
`,
  agents: { reader: readerAgent },
  defaultOptions: {
    delegation: { onDelegationStart: pinSubagentSteps },
  },
  durable: true,
  inputProcessors: [
    stripFilePartsProcessor,
    hoistToolResultMediaProcessor,
    stripGeminiReasoningProcessor,
  ],
  memory: getAgentMemory("thread"),
  requestContextSchema: mnemonicRequestContextSchema,
  model: getThreadModel,
  name: "Conversation",
  tools: conversationAgentTools,
});
