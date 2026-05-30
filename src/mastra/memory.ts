import type { MastraMemory } from "@mastra/core/memory";
import type { MemoryStorage } from "@mastra/core/storage";
import { panic } from "better-result";

import { mastra } from "@/mastra";
import { mnemonicAgentId } from "@/mastra/agents/mnemonic-agent";

export const getAgentMemory = async (): Promise<MastraMemory> => {
  const agent = mastra.getAgentById(mnemonicAgentId);
  const memory = await agent.getMemory();

  if (memory === undefined) {
    panic("Agent memory is not configured");
  }

  return memory;
};

export const getMemoryStore = async (): Promise<MemoryStorage> => {
  const memoryStore = await mastra.getStorage()?.getStore("memory");

  if (memoryStore === undefined) {
    panic("Mastra memory storage is not configured");
  }

  return memoryStore;
};
