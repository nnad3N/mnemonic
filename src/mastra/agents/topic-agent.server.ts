import { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { Result } from "better-result";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import { getAgentMemory } from "@/mastra/agent-memory.server";
import {
  baseInstructions,
  sharedSourceInstructions,
  sharedWebResearchInstructions,
} from "@/mastra/agents/base-instructions.server";
import { webResearchAgent } from "@/mastra/agents/web-research-agent.server";
import { getAgentModel } from "@/mastra/models.server";
import { stripNonNativeFilePartsProcessor } from "@/mastra/processors/strip-non-native-file-parts.server";
import { workSegmentTimingProcessor } from "@/mastra/processors/work-segment-timing";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { docsTool } from "@/mastra/tools/docs-tool.server";
import { executeCodeTool } from "@/mastra/tools/execute-code-tool.server";
import { createFileGraphRagTool } from "@/mastra/tools/file-graph-rag-tool.server";
import { createFileVectorSearchTool } from "@/mastra/tools/file-vector-search-tool.server";
import { getFileTool } from "@/mastra/tools/get-file-tool.server";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool.server";
import { webSearchTool } from "@/mastra/tools/web-search-tool.server";

export const TOPIC_AGENT_ID = "topic-agent";

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
    docs: docsTool,
    executeCode: executeCodeTool,
    fileGraphRag: createFileGraphRagTool(apiKey),
    fileVectorSearch: createFileVectorSearchTool(apiKey),
    getFile: getFileTool,
    webFetch: webFetchTool,
    webSearch: webSearchTool,
  };
};

export type TopicAgentTools = Awaited<ReturnType<typeof getTopicAgentTools>>;

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
  durable: true,
  inputProcessors: [stripNonNativeFilePartsProcessor],
  outputProcessors: [workSegmentTimingProcessor],
  memory: getAgentMemory("resource"),
  requestContextSchema: mnemonicRequestContextSchema,
  model: getAgentModel,
  name: "Topic",
  tools: getTopicAgentTools,
});
