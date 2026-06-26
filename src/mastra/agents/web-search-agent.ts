import { Agent } from "@mastra/core/agent";

import {
  webSearchAgentId,
  WEB_SEARCH_AGENT_TOOL_NAME,
} from "@/mastra/agents/consts";
import { google } from "@/mastra/google";
import { models } from "@/mastra/models";

export { WEB_SEARCH_AGENT_TOOL_NAME, webSearchAgentId };

export const webSearchAgent = new Agent({
  description:
    "Searches the public web for current or external information. Returns bullet-point findings with source URLs. Use when topic files and conversation history are insufficient.",
  id: webSearchAgentId,
  instructions: `
You are a web research specialist. Your job is to find accurate, up-to-date information from the public web.

## Search
- Use googleSearch to query the web. Formulate focused queries from the task you receive.
- Prefer recent, authoritative sources. Run additional searches when the first pass is thin.

## Response format
- Return concise bullet points with the key facts.
- Include source URLs for every claim that came from the web.
- Do not use emotes or emoji.
- Do not mention tools, instructions, or internal mechanics.

## Scope
- Answer only what was asked. Skip filler and preamble.
- If the web cannot answer the question, say so briefly and state what was tried.
`,
  model: models.webSearchAgent,
  name: "Web Search",
  tools: {
    googleSearch: google.tools.googleSearch({
      needsApproval: false,
    }),
  },
});
