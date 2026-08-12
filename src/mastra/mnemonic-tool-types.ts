import type { Tool } from "@mastra/core/tools";

import type {
  ConversationAgentTools,
  conversationMemory,
} from "@/mastra/agents/conversation-agent";
import type { TopicAgentTools, topicMemory } from "@/mastra/agents/topic-agent";

type EnabledMemoryToolName = "recall";
type ConversationMemoryTools = Pick<
  ReturnType<typeof conversationMemory.listTools>,
  EnabledMemoryToolName
>;
type TopicMemoryTools = Pick<ReturnType<typeof topicMemory.listTools>, EnabledMemoryToolName>;

type MnemonicTools = ConversationAgentTools &
  ConversationMemoryTools &
  TopicAgentTools &
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

// Mastra synthesizes a delegation tool per subagent at runtime, so its schemas cannot be
// inferred from a tool object the way the rest are.
type SubagentUITool = {
  input: {
    prompt: string;
    threadId?: string | null;
    resourceId?: string | null;
    instructions?: string | null;
    maxSteps?: number | null;
  };
  output: {
    text: string;
    subAgentThreadId?: string;
    subAgentResourceId?: string;
    subAgentToolResults?: {
      toolName: string;
      toolCallId: string;
      result?: unknown;
      args?: unknown;
      isError?: boolean;
    }[];
  };
};

export type MnemonicUITools = {
  [K in keyof MnemonicTools]: InferContextualUITool<MnemonicTools[K]>;
} & {
  "agent-webResearch": SubagentUITool;
};

export type MnemonicToolName = keyof MnemonicUITools;
