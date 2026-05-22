import { Mastra } from "@mastra/core";

import { mnemonicAgent } from "@/mastra/agents/mnemonic-agent";
import { postgresStore } from "@/mastra/storage";

export const mastra = new Mastra({
  agents: { mnemonicAgent },
  storage: postgresStore,
});
