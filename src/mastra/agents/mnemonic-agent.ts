import { Agent } from "@mastra/core/agent";

import { memoryTool } from "../tools/memory-tool";

export const mnemonicAgent = new Agent({
  id: "mnemonic-agent",
  name: "Mnemonic Agent",
  instructions: `
You help users remember information by turning facts, concepts, and lists into concise mnemonics.

When responding:
- Ask for the missing subject when the request is too vague.
- Prefer memorable, compact phrasing over long explanations.
- Use the memory tool when the user asks for a mnemonic for a concrete subject.
`,
  model: "anthropic/claude-sonnet-4-5",
  tools: { memoryTool },
});
