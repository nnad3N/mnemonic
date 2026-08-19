import { isDurableAgent } from "@mastra/core/agent/durable";
import type { DurableAgent } from "@mastra/core/agent/durable";

import * as Kit from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";
import { CONVERSATION_AGENT_ID, TOPIC_AGENT_ID } from "@/mastra/agent-models.server";
import { mastra } from "@/mastra/instance.server";

export type MnemonicAgentId = typeof TOPIC_AGENT_ID | typeof CONVERSATION_AGENT_ID;

export const MnemonicAgentIds = Kit.literals.from<MnemonicAgentId>()([
  CONVERSATION_AGENT_ID,
  TOPIC_AGENT_ID,
]);

type GetMnemonicAgentIdInput = {
  topicId: SafeId<"topic"> | undefined;
};

export const getMnemonicAgentId = ({ topicId }: GetMnemonicAgentIdInput): MnemonicAgentId =>
  topicId ? TOPIC_AGENT_ID : CONVERSATION_AGENT_ID;

export const getMnemonicAgent = (agentId: MnemonicAgentId): DurableAgent => {
  const agent = mastra.getAgentById(agentId);

  if (!isDurableAgent(agent)) {
    throw new Error(`Agent ${agentId} is not registered as durable`);
  }

  return agent;
};
