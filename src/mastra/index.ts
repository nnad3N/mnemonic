import { Mastra } from "@mastra/core";

import { conversationAgent } from "@/mastra/agents/conversation-agent";
import { topicAgent } from "@/mastra/agents/topic-agent";
import { VECTOR_STORE_NAME, libsqlStore, libsqlVector } from "@/mastra/storage";
import { processFileWorkflow } from "@/routes/_protected.chat.$threadId/-thread-api/upload-file-workflow";

export const mastra = new Mastra({
  agents: { conversationAgent, topicAgent },
  storage: libsqlStore,
  vectors: { [VECTOR_STORE_NAME]: libsqlVector },
  workflows: { "process-file": processFileWorkflow },
});
