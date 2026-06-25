import type { InferUITool } from "@mastra/core/tools";

import type {
  mnemonicAgentTools,
  mnemonicMemory,
} from "@/mastra/agents/mnemonic-agent";

type EnabledMemoryToolName = "recall" | "updateWorkingMemory";
type MemoryTools = Pick<
  ReturnType<typeof mnemonicMemory.listTools>,
  EnabledMemoryToolName
>;

type MnemonicTools = typeof mnemonicAgentTools & MemoryTools;

export type MnemonicUITools = {
  [K in keyof MnemonicTools]: InferUITool<MnemonicTools[K]>;
};
