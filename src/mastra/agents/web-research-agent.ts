import { Agent } from "@mastra/core/agent";
import { ProviderHistoryCompat } from "@mastra/core/processors";
import type { CompatRule } from "@mastra/core/processors";
import { Memory } from "@mastra/memory";

import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types";
import { models } from "@/mastra/models";
import { stripNonNativeFilePartsProcessor } from "@/mastra/processors/strip-non-native-file-parts";
import { mnemonicRequestContextSchema } from "@/mastra/request-context";
import { libsqlStore } from "@/mastra/storage";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool";
import { webSearchTool } from "@/mastra/tools/web-search-tool";

export const WEB_RESEARCH_AGENT_ID = "web-research-agent";

const MAX_WEB_SEARCH_CALLS = 3;
const WEB_SEARCH_TOOL_NAME = "webSearch" satisfies MnemonicToolName;

/** Without its own memory a subagent inherits the parent's, including observational memory. */
const webResearchMemory = new Memory({ storage: libsqlStore });

/**
 * The delegation forwards parent conversation context whose assistant messages can carry
 * encrypted reasoning from another model tier. OpenRouter refuses to replay encrypted
 * reasoning to a different model (404), so strip all reasoning from the outbound prompt.
 */
const stripReasoningHistory: CompatRule = {
  name: "strip-reasoning-history",
  applyToPrompt: ({ prompt }) => {
    let mutated = false;

    const next = prompt.map((message) => {
      if (message.role !== "assistant") {
        return message;
      }

      const content = message.content.filter((part) => part.type !== "reasoning");

      if (content.length === message.content.length) {
        return message;
      }

      mutated = true;
      return {
        ...message,
        content,
      };
    });

    return mutated ? next : undefined;
  },
};

export const webResearchAgent = new Agent({
  description: "Researches a task on the live web across multiple searches and page reads.",
  id: WEB_RESEARCH_AGENT_ID,
  instructions: `
You research a task on the live web and report back to the assistant that delegated it. That assistant is your only reader; you never address the end user, and your report is never shown to them.

## Decisions
- Cover every part of the delegated task.
- Stop as soon as you can answer the task, or as soon as it is clear you cannot.
- Never ask questions back. When the task is ambiguous, research the most useful reading of it and state in the report which reading you took.
- When sources disagree on something that matters, report the disagreement and who says what, rather than silently picking one.

## Report
Reply with the report only, no preamble and no narration of how you searched.
- Report findings and conclusions, not raw page content.
- Cite the source URL for every claim so the delegating assistant can cite it without reading the page again.
- End with a source list, one line per URL, saying what it contributed.
- When the task cannot be fully answered, report what you found and what is missing.
`,
  inputProcessors: [
    stripNonNativeFilePartsProcessor,
    new ProviderHistoryCompat({ additionalRules: [stripReasoningHistory] }),
  ],
  defaultOptions: {
    maxSteps: 15,
    stopWhen: ({ steps }: { steps: { toolCalls: { toolName: string }[] }[] }) => {
      let webSearchCallCount = 0;

      for (const step of steps) {
        for (const toolCall of step.toolCalls) {
          if (toolCall.toolName === WEB_SEARCH_TOOL_NAME) {
            webSearchCallCount += 1;
          }
        }
      }

      return webSearchCallCount > MAX_WEB_SEARCH_CALLS;
    },
  },
  memory: webResearchMemory,
  requestContextSchema: mnemonicRequestContextSchema,
  model: models.forModelCapability("standard"),
  name: "WebResearch",
  tools: {
    webFetch: webFetchTool,
    webSearch: webSearchTool,
  },
});
