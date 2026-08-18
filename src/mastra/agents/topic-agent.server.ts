import { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { Result } from "better-result";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import { getAgentMemory } from "@/mastra/agent-memory.server";
import {
  baseInstructions,
  sharedDelegationInstructions,
  sharedSourceInstructions,
} from "@/mastra/agents/base-instructions.server";
import { workerAgent } from "@/mastra/agents/worker-agent.server";
import { getAgentModel } from "@/mastra/models.server";
import { stripFilePartsProcessor } from "@/mastra/processors/strip-file-parts.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { computeDocsTool } from "@/mastra/tools/compute-docs-tool.server";
import { computeTool } from "@/mastra/tools/compute-tool.server";
import { createFileGraphRagTool } from "@/mastra/tools/file-graph-rag-tool.server";
import { createFileVectorSearchTool } from "@/mastra/tools/file-vector-search-tool.server";
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
    compute: computeTool,
    computeDocs: computeDocsTool,
    fileGraphRag: createFileGraphRagTool(apiKey),
    fileVectorSearch: createFileVectorSearchTool(apiKey),
    webFetch: webFetchTool,
    webSearch: webSearchTool,
  };
};

export type TopicAgentTools = Awaited<ReturnType<typeof getTopicAgentTools>>;

export const topicAgent = new Agent({
  description:
    "Uses topic file search, topic-scoped conversation recall, web search/fetch and a worker subagent to answer topic-specific questions.",
  id: TOPIC_AGENT_ID,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Conflict → topic files over web, web over recall.
Files: search by meaning or by connections yourself for pointed questions; no need to run every file tool. Reading files whole → delegation.

${sharedDelegationInstructions}
`,
  agents: { worker: workerAgent },
  durable: true,
  inputProcessors: [stripFilePartsProcessor],
  memory: getAgentMemory("resource"),
  requestContextSchema: mnemonicRequestContextSchema,
  model: getAgentModel,
  name: "Topic",
  tools: getTopicAgentTools,
});
