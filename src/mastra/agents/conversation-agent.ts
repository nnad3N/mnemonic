import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

import { baseInstructions, sharedSourceInstructions } from "@/mastra/agents/base-instructions";
import { getAgentModel, models, observationalMemoryOptions } from "@/mastra/models";
import { stripNonNativeFilePartsProcessor } from "@/mastra/processors/strip-non-native-file-parts";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";
import { libsqlStore, libsqlVector } from "@/mastra/storage";
import { executeCodeTool } from "@/mastra/tools/execute-code-tool";
import { getFileTool } from "@/mastra/tools/get-file-tool";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool";
import { webSearchTool } from "@/mastra/tools/web-search-tool";

export const conversationAgentId = "conversation-agent";

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

export const conversationAgentTools = {
  executeCode: executeCodeTool,
  getFile: getFileTool,
  webFetch: webFetchTool,
  webSearch: webSearchTool,
} as const;

export const conversationAgent = new Agent({
  id: conversationAgentId,
  instructions: `
${baseInstructions}

${sharedSourceInstructions}

Available sources:
- Conversation recall: past messages in the current conversation only. Prefer this when the answer may already appear in prior chat.
- Uploaded files: use getFile by mention key.
- Web: current or external information via webSearch (discover pages) or webFetch (read a known URL).

## Web
- Use webSearch to discover pages when no specific URL is known.
- Use webFetch when the user provided a URL or a prior search already identified the page to read.
- Prefer these when the question needs facts outside this conversation or up-to-date information from the web, or when conversation recall did not fully answer.
- Tool descriptions own exact input requirements and result shapes.

## Conversation history
Use recall to browse past messages in the current conversation only:
- mode "messages" — read messages from the current thread.
- mode "search" with query — find relevant messages in the current thread.
`,
  inputProcessors: [stripNonNativeFilePartsProcessor],
  memory: conversationMemory,
  requestContextSchema: mnemonicRequestContextSchema,
  model: getAgentModel,
  name: "Conversation",
  tools: conversationAgentTools,
});
