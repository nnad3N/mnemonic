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
import { pinSubagentSteps } from "@/mastra/processors/soft-stop.server";
import { stripFilePartsProcessor } from "@/mastra/processors/strip-file-parts.server";
import { stripGeminiReasoningProcessor } from "@/mastra/processors/strip-gemini-reasoning.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { computeDocsTool } from "@/mastra/tools/compute-docs-tool.server";
import { computeTool } from "@/mastra/tools/compute-tool.server";
import { createFileGraphRagTool } from "@/mastra/tools/file-graph-rag-tool.server";
import { createFileVectorSearchTool } from "@/mastra/tools/file-vector-search-tool.server";
import { readNoteTool } from "@/mastra/tools/read-note-tool.server";
import { searchNotesTool } from "@/mastra/tools/search-notes-tool.server";
import { updateNoteTool } from "@/mastra/tools/update-note-tool.server";
import { webSearchTool } from "@/mastra/tools/web-search-tool.server";
import { writeNoteTool } from "@/mastra/tools/write-note-tool.server";

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
    fileGraphRag: createFileGraphRagTool(apiKey),
    fileVectorSearch: createFileVectorSearchTool(apiKey),
    readNote: readNoteTool,
    searchNotes: searchNotesTool,
    updateNote: updateNoteTool,
    webSearch: webSearchTool,
    writeNote: writeNoteTool,
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

## Delegating
Do yourself: search topic files by meaning or by connections for pointed questions; no need to run every file tool. Every read goes to a subagent. Sources you located -> reader. Question that must find its own sources -> worker.
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
  inputProcessors: [stripFilePartsProcessor, stripGeminiReasoningProcessor],
  memory: getAgentMemory("resource"),
  requestContextSchema: mnemonicRequestContextSchema,
  model: getThreadModel,
  name: "Topic",
  tools: getTopicAgentTools,
});
