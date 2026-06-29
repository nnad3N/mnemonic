import { Mastra } from "@mastra/core";

import { conversationAgent } from "@/mastra/agents/conversation-agent";
import { topicAgent } from "@/mastra/agents/topic-agent";
import {
  PG_VECTOR_STORE_NAME,
  pgVector,
  postgresStore,
} from "@/mastra/storage";
import { processArtifactWorkflow } from "@/routes/_protected.chat.$threadId/-thread-api/upload-file-workflow";

export const mastra = new Mastra({
  agents: { conversationAgent, topicAgent },
  storage: postgresStore,
  vectors: { [PG_VECTOR_STORE_NAME]: pgVector },
  workflows: { "process-artifact": processArtifactWorkflow },
});
