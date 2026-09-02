import { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { Result } from "better-result";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import { getAgentMemory } from "@/mastra/agent-memory.server";
import { baseInstructions } from "@/mastra/agents/base-instructions.server";
import { readerAgent } from "@/mastra/agents/reader-agent.server";
import { workerAgent } from "@/mastra/agents/worker-agent.server";
import { getThreadModel } from "@/mastra/config.server";
import { TOPIC_AGENT_ID } from "@/mastra/models.server";
import { hoistToolResultMediaProcessor } from "@/mastra/processors/hoist-tool-result-media.server";
import { pinSubagentSteps } from "@/mastra/processors/soft-stop.server";
import { stripFilePartsProcessor } from "@/mastra/processors/strip-file-parts.server";
import { stripGeminiReasoningProcessor } from "@/mastra/processors/strip-gemini-reasoning.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { computeDocsTool } from "@/mastra/tools/compute-docs-tool.server";
import { computeTool } from "@/mastra/tools/compute-tool.server";
import { createNoteTool } from "@/mastra/tools/create-note-tool.server";
import { createFileVectorSearchTool } from "@/mastra/tools/file-vector-search-tool.server";
import { listFilesTool } from "@/mastra/tools/list-files-tool.server";
import { readFileTool } from "@/mastra/tools/read-file-tool.server";
import { readNoteTool } from "@/mastra/tools/read-note-tool.server";
import { searchFilesTool } from "@/mastra/tools/search-files-tool.server";
import { searchNotesTool } from "@/mastra/tools/search-notes-tool.server";
import { updateNoteTool } from "@/mastra/tools/update-note-tool.server";
import { userLinkWebFetchTool } from "@/mastra/tools/web-fetch-tool.server";
import { webSearchTool } from "@/mastra/tools/web-search-tool.server";

const providerKeyCtx = Kit.createContext(dbKit);

type GetTopicAgentToolsInput = {
  requestContext: RequestContext<MnemonicRequestContext>;
};

const getTopicAgentTools = async ({ requestContext }: GetTopicAgentToolsInput) => {
  const result = await resolveProviderKeyById(providerKeyCtx, requestContext.get("providerKeyId"));

  if (Result.isError(result)) {
    throw result.error;
  }

  const apiKey = result.value.key;

  return {
    compute: computeTool,
    computeDocs: computeDocsTool,
    fileVectorSearch: createFileVectorSearchTool(apiKey),
    listFiles: listFilesTool,
    readFile: readFileTool,
    readNote: readNoteTool,
    searchFiles: searchFilesTool,
    searchNotes: searchNotesTool,
    updateNote: updateNoteTool,
    webFetch: userLinkWebFetchTool,
    webSearch: webSearchTool,
    createNote: createNoteTool,
  };
};

export type TopicAgentTools = Awaited<ReturnType<typeof getTopicAgentTools>>;

export const topicAgent = new Agent({
  description:
    "Uses topic file search, topic-scoped conversation recall, web search/fetch and a worker subagent to answer topic-specific questions.",
  id: TOPIC_AGENT_ID,
  instructions: `
${baseInstructions}

Conflict -> topic files over web, web over recall.

## Topic files
List files to see what topic holds. Question over topic files: search, one query per distinct part of the question. Hits map which file and pages matter; then compute over that file for the evidence.
Reading file whole is last resort. Only when task literally needs entire file and no extract serves: summarize whole book, structure of whole document. Passage, fact, chapter -> search then compute, not whole file.

## Delegating
User gave one link -> fetch it yourself. Web pages you located, or reads across several files -> reader. Question that must find its own sources -> worker.
Never delegate ambiguous task. Resolve scope with user first.
Subagent sees only your prompt, not conversation: exact question, output wanted, every URL and file mention key, user constraints.
Question has separate parts -> split it, one delegation per part, no overlap between them, all in same turn. One part -> one delegation for whole task.
Report answers its task; never redo its work to check it. Part unanswered -> delegate remainder or tell user what is missing.
`,
  agents: { reader: readerAgent, worker: workerAgent },
  defaultOptions: {
    delegation: { onDelegationStart: pinSubagentSteps },
  },
  durable: true,
  inputProcessors: [
    stripFilePartsProcessor,
    hoistToolResultMediaProcessor,
    stripGeminiReasoningProcessor,
  ],
  memory: getAgentMemory("resource"),
  requestContextSchema: mnemonicRequestContextSchema,
  model: getThreadModel,
  name: "Topic",
  tools: getTopicAgentTools,
});
