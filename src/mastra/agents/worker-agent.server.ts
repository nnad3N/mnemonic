import { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { createCodeMode } from "@mastra/core/tools";
import { IsolatedVmCodeModeTransport } from "@mastra/isolated-vm";
import { Memory } from "@mastra/memory";
import { Result } from "better-result";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { resolveProviderKeyById } from "@/lib/middleware/resolve-provider-key.server";
import { getAgentModel } from "@/mastra/config.server";
import { WORKER_AGENT_ID } from "@/mastra/models.server";
import { hoistToolResultMediaProcessor } from "@/mastra/processors/hoist-tool-result-media.server";
import { stripGeminiReasoningProcessor } from "@/mastra/processors/strip-gemini-reasoning.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { libsqlStore } from "@/mastra/storage.server";
import { createFileGraphRagTool } from "@/mastra/tools/file-graph-rag-tool.server";
import { createFileVectorSearchTool } from "@/mastra/tools/file-vector-search-tool.server";
import { readTextTool } from "@/mastra/tools/read-text-tool.server";
import { readVisualsTool } from "@/mastra/tools/read-visuals-tool.server";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool.server";
import { webSearchTool } from "@/mastra/tools/web-search-tool.server";

/** Without its own memory a subagent inherits the parent's, including observational memory. */
const workerMemory = new Memory({ storage: libsqlStore });

const codeModeTransport = new IsolatedVmCodeModeTransport();

const providerKeyCtx = Kit.createContext(dbKit);

type GetWorkerCodeModeInput = {
  requestContext: RequestContext<MnemonicRequestContext>;
};

/**
 * The retrieval tools embed with the user's key, so code mode and the stubs in its instructions
 * are built per request. Mastra resolves `tools` and `instructions` separately, hence both call this.
 */
const getWorkerCodeMode = async ({ requestContext }: GetWorkerCodeModeInput) => {
  const result = await resolveProviderKeyById(providerKeyCtx, requestContext.get("providerKeyId"));

  if (Result.isError(result)) {
    throw result.error;
  }

  const apiKey = result.value.key;

  return createCodeMode(
    {
      tools: {
        fileGraphRag: createFileGraphRagTool(apiKey),
        fileVectorSearch: createFileVectorSearchTool(apiKey),
        readText: readTextTool,
        webFetch: webFetchTool,
        webSearch: webSearchTool,
      },
    },
    codeModeTransport,
  );
};

const workerInstructions = `
You carry out a research task over current topic's files and live web, and report to the assistant that delegated it. That assistant is your only reader; never address end user.

Topic files: search by meaning or by connections across files; read text whole when task needs. Images, charts, layout, scans -> view the file.
Web: search to discover pages, fetch to read known URL. Few distinct queries that cover different parts of the task; never similar searches in a row, and never more than a few. Relevant -> stop searching and read; verification is reading, not more search. Noisy or empty -> stop and report what is missing.
One program gathers from several sources and shapes data (filter, compare, count) so only what task needs comes back; not one call per source.
Cover every part of task. Stop when answered, or when clearly cannot.
Never ask back. Ambiguous -> research most useful reading, say which in report.
Sources disagree on something that matters -> report disagreement and who says what.

## Report
Report only. No preamble, no narration. Findings and conclusions, not raw content.
Cite every claim: URL for web; file name plus most precise locator (page, section, line, table) for files.
End with source list, one line per URL or file, what it contributed.
Cannot fully answer -> what found, what missing. Nothing relevant -> say so.
`;

export const workerAgent = new Agent({
  description:
    "Generic research task over the current topic's files and the live web: discovers its own sources across searches and reads, and reports findings with citations.",
  id: WORKER_AGENT_ID,
  instructions: async (input) =>
    `${workerInstructions}\n${(await getWorkerCodeMode(input)).instructions}\n`,
  defaultOptions: {
    maxSteps: 15,
  },
  inputProcessors: [hoistToolResultMediaProcessor, stripGeminiReasoningProcessor],
  memory: workerMemory,
  requestContextSchema: mnemonicRequestContextSchema,
  model: getAgentModel(WORKER_AGENT_ID),
  name: "Worker",
  tools: async (input) => ({
    execute_typescript: (await getWorkerCodeMode(input)).tool,
    readVisuals: readVisualsTool,
  }),
});
