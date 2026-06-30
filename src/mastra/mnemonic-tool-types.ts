import type { InferUITool } from "@mastra/core/tools";

import type {
  conversationAgentTools,
  conversationMemory,
} from "@/mastra/agents/conversation-agent";
import type { topicAgentTools, topicMemory } from "@/mastra/agents/topic-agent";

type EnabledMemoryToolName = "recall";
type ConversationMemoryTools = Pick<
  ReturnType<typeof conversationMemory.listTools>,
  EnabledMemoryToolName
>;
type TopicMemoryTools = Pick<
  ReturnType<typeof topicMemory.listTools>,
  EnabledMemoryToolName
>;

type MnemonicTools = typeof conversationAgentTools &
  ConversationMemoryTools &
  typeof topicAgentTools &
  TopicMemoryTools;

export type MnemonicUITools = {
  [K in keyof MnemonicTools]: InferUITool<MnemonicTools[K]>;
};
