import type { SafeId } from "@/lib/safe-id";
import { CONVERSATION_AGENT_ID } from "@/mastra/agents/conversation-agent.server";
import { TOPIC_AGENT_ID } from "@/mastra/agents/topic-agent.server";

export type MnemonicAgentId = typeof TOPIC_AGENT_ID | typeof CONVERSATION_AGENT_ID;

type GetMnemonicAgentIdInput = {
  topicId: SafeId<"topic"> | undefined;
};

export const getMnemonicAgentId = ({ topicId }: GetMnemonicAgentIdInput): MnemonicAgentId =>
  topicId ? TOPIC_AGENT_ID : CONVERSATION_AGENT_ID;
