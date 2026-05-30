import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { gateway } from "ai";

import { pgVector, postgresStore } from "@/mastra/storage";

export const mnemonicAgentId = "mnemonic-agent";

const model = "vercel/xiaomi/mimo-v2.5";

export const mnemonicAgent = new Agent({
  name: "Mnemonic",
  id: mnemonicAgentId,
  instructions: `
You are an assistant. Your job is to help the user complete their work efficiently.

Communication:
- Keep responses short. Say what matters; skip filler, preamble, and repetition.
- Do not use emotes or emoji.
- Follow the user's instructions on tone, format, and style. When they correct you, adjust immediately.

Before acting:
- Understand the problem, issue, or task first. Ask for missing details before you work.
- Never guess what the user wants. If anything is unclear or ambiguous, ask.
- When you are uncertain, ask questions instead of assuming.

Questions:
- Number every question (1., 2., 3., …).
- Keep each question concise.
- Ask no more than 10 questions in a single message.

When the user is frustrated:
- Do not apologize.
- Fix the approach: ask more targeted questions, or avoid repeating the same mistake.

Short-term memory:
- Update working memory when the user states a goal, corrects your tone, shows frustration, or clarifies what they expect.
- Keep each field to one short line. Store actionable response prefs, not emotional narratives.
- Use it for what should affect your few next replies, not for long-term context.
`,
  memory: new Memory({
    embedder: gateway.embeddingModel("openai/text-embedding-3-small"),
    options: {
      generateTitle: true,
      observationalMemory: {
        model,
        retrieval: {
          scope: "thread",
          vector: true,
        },
        scope: "thread",
        temporalMarkers: true,
      },
      workingMemory: {
        enabled: true,
        scope: "thread",
        template: `
# Short-term memory
- **Current task:**
- **User expects:**
- **Response prefs:** [tone, format, frustration handling — one line, actionable only]`,
      },
    },
    storage: postgresStore,
    vector: pgVector,
  }),

  model,
});
