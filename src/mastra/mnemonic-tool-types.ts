import type { Tool } from "@mastra/core/tools";

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
type TopicMemoryTools = Pick<ReturnType<typeof topicMemory.listTools>, EnabledMemoryToolName>;

type MnemonicTools = typeof conversationAgentTools &
  ConversationMemoryTools &
  typeof topicAgentTools &
  TopicMemoryTools;

// Mastra's InferUITool only matches the first four Tool generics, so tools with a typed
// request context fail its conditional type and infer input/output as never.
type InferContextualUITool<TTool> =
  TTool extends Tool<
    infer Input,
    infer Output,
    infer _Suspend,
    infer _Resume,
    infer _Context,
    infer _Id,
    infer _RequestContext
  >
    ? { input: Input; output: Output }
    : never;

export type MnemonicUITools = {
  [K in keyof MnemonicTools]: InferContextualUITool<MnemonicTools[K]>;
};
