import { Mastra } from "@mastra/core";

import { mnemonicAgent } from "@/mastra/agents/mnemonic-agent";
import { postgresStore } from "@/mastra/storage";
import { processArtifactWorkflow } from "@/routes/_protected.chat.$threadId/-thread-api/upload-file-workflow";

export const mastra = new Mastra({
  agents: { mnemonicAgent },
  storage: postgresStore,
  workflows: { "process-artifact": processArtifactWorkflow },
});
