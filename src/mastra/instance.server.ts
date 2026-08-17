import { Mastra } from "@mastra/core";

import { durableAgentsCache, durableAgentsPubsub } from "@/lib/durable-agents-kit.server";
import { conversationAgent } from "@/mastra/agents/conversation-agent.server";
import { topicAgent } from "@/mastra/agents/topic-agent.server";
import { VECTOR_STORE_NAME, libsqlStore, libsqlVector } from "@/mastra/storage.server";
import { processFileWorkflow } from "@/routes/_protected.chat.$threadId/-thread-api/upload-file-workflow.server";

export const mastra = new Mastra({
  agents: { conversationAgent, topicAgent },
  cache: durableAgentsCache,
  pubsub: durableAgentsPubsub,
  storage: libsqlStore,
  vectors: { [VECTOR_STORE_NAME]: libsqlVector },
  workflows: { "process-file": processFileWorkflow },
});
