import { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";

import { getAgentMemory } from "@/mastra/agent-memory.server";
import { baseInstructions } from "@/mastra/agents/base-instructions.server";
import { readerAgent } from "@/mastra/agents/reader-agent.server";
import { resolveAgentModel } from "@/mastra/config.server";
import { CONVERSATION_AGENT_ID, getAgentModel } from "@/mastra/models.server";
import { hoistToolResultMediaProcessor } from "@/mastra/processors/hoist-tool-result-media.server";
import { pinSubagentSteps } from "@/mastra/processors/soft-stop.server";
import { stripFilePartsProcessor } from "@/mastra/processors/strip-file-parts.server";
import { stripGeminiReasoningProcessor } from "@/mastra/processors/strip-gemini-reasoning.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { computeDocsTool } from "@/mastra/tools/compute-docs-tool.server";
import { computeTool } from "@/mastra/tools/compute-tool.server";
import { createNoteTool } from "@/mastra/tools/create-note-tool.server";
import { readFileTool } from "@/mastra/tools/read-file-tool.server";
import { readNoteTool } from "@/mastra/tools/read-note-tool.server";
import { readTextTool } from "@/mastra/tools/read-text-tool.server";
import { searchFileTool } from "@/mastra/tools/search-file-tool.server";
import { searchNotesTool } from "@/mastra/tools/search-notes-tool.server";
import { updateNoteTool } from "@/mastra/tools/update-note-tool.server";
import { userLinkWebFetchTool } from "@/mastra/tools/web-fetch-tool.server";
import { webSearchTool } from "@/mastra/tools/web-search-tool.server";

const conversationAgentSharedTools = {
  compute: computeTool,
  computeDocs: computeDocsTool,
  readNote: readNoteTool,
  searchFile: searchFileTool,
  searchNotes: searchNotesTool,
  updateNote: updateNoteTool,
  webSearch: webSearchTool,
  createNote: createNoteTool,
} as const;

type GetConversationAgentToolsInput = {
  requestContext: RequestContext<MnemonicRequestContext>;
};

const getConversationAgentTools = ({ requestContext }: GetConversationAgentToolsInput) => {
  const modelOption = requestContext.get("modelOption");

  if (modelOption === "knowledge") {
    return conversationAgentSharedTools;
  }

  const { inputs } = getAgentModel(CONVERSATION_AGENT_ID, modelOption);

  if (inputs.images) {
    return {
      ...conversationAgentSharedTools,
      readFile: readFileTool,
      webFetch: userLinkWebFetchTool,
    };
  }

  return {
    ...conversationAgentSharedTools,
    readText: readTextTool,
    webFetch: userLinkWebFetchTool,
  };
};

export type ConversationAgentTools = ReturnType<typeof getConversationAgentTools>;

export const conversationAgent = new Agent({
  id: CONVERSATION_AGENT_ID,
  instructions: `
${baseInstructions}

Do yourself: search a file for whether or where it contains something. User gave one file -> work it yourself. Search, one query per distinct part, in the file's words. Hits map where the evidence is, not the evidence. Term missing from hits proves nothing. Relevant material might sit next to a hit -> expand search slightly, then compute. Read whole only when task needs whole file. Anything else -> reader: second file, any page or file you found, however few.
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
  model: resolveAgentModel(CONVERSATION_AGENT_ID),
  name: "Conversation",
  tools: getConversationAgentTools,
});
