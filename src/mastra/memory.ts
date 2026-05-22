import { panic } from "better-result";

import { mastra } from "@/mastra";

export const getMemoryStore = async () => {
  const memoryStore = await mastra.getStorage()?.getStore("memory");

  if (memoryStore === undefined) {
    panic("Mastra memory storage is not configured");
  }

  return memoryStore;
};
