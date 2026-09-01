import { Agent } from "@mastra/core/agent";
import { createCodeMode } from "@mastra/core/tools";
import { IsolatedVmCodeModeTransport } from "@mastra/isolated-vm";
import { Memory } from "@mastra/memory";

import { getStaticModel } from "@/mastra/config.server";
import { READER_AGENT_ID, SUBAGENT_MODEL } from "@/mastra/models.server";
import { hoistToolResultMediaProcessor } from "@/mastra/processors/hoist-tool-result-media.server";
import { readerSoftStop } from "@/mastra/processors/soft-stop.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { mastraStore } from "@/mastra/storage.server";
import { readTextTool } from "@/mastra/tools/read-text-tool.server";
import { readVisualsTool } from "@/mastra/tools/read-visuals-tool.server";
import { webFetchTool } from "@/mastra/tools/web-fetch-tool.server";

/** Without its own memory a subagent inherits the parent's, including observational memory. */
const readerMemory = new Memory({ storage: mastraStore });

const codeMode = createCodeMode(
  { tools: { readText: readTextTool, webFetch: webFetchTool } },
  new IsolatedVmCodeModeTransport(),
);

export const readerAgent = new Agent({
  description:
    "Focused read of the web pages and files named in the task, up to 5 steps, reporting what they say about the question with quotes and locators. Every source must be given explicitly.",
  id: READER_AGENT_ID,
  instructions: `
You read sources named in a task and report to the assistant that delegated it. That assistant is your only reader; never address end user.

Task gives sources (URLs, file mention keys) and what to find or produce. No search available. Source missing -> say so in report.
Read what task needs, not everything: search long file for relevant passages first; read source whole only when task spans it (summary, structure, what is missing). Images, charts, layout, scans -> view the file.
One program reads several sources and returns only what task asked; not one call per source.
Never ask back. Ambiguous -> answer most useful reading, say which.

## Report
Report only. No preamble, no narration.
Requested output first, in requested shape. Then short quotes with most precise locator source allows (page, section, line, table; heading or anchor for web) and which source each is from.
Sources do not settle task -> say so, state closest thing they cover. Never fill gap from own knowledge. Quote, do not paste.

${codeMode.instructions}
`,
  defaultOptions: {
    maxSteps: readerSoftStop.maxSteps,
  },
  inputProcessors: [hoistToolResultMediaProcessor, readerSoftStop.processor],
  memory: readerMemory,
  requestContextSchema: mnemonicRequestContextSchema,
  model: getStaticModel(SUBAGENT_MODEL),
  name: "Reader",
  tools: {
    execute_typescript: codeMode.tool,
    readVisuals: readVisualsTool,
  },
});
