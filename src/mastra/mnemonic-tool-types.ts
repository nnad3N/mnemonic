import type { ToolAction } from "@mastra/core/tools";

import type { mnemonicMemory } from "@/mastra/agents/mnemonic-agent";

type InferToolActionUITool<T> =
  T extends ToolAction<infer Input, infer Output>
    ? {
        input: Input;
        output: Output;
      }
    : never;

type InferToolActionUITools<Tools extends Record<string, unknown>> = {
  [Name in keyof Tools & string]: InferToolActionUITool<Tools[Name]>;
};

type EnabledMemoryToolName = "recall" | "updateWorkingMemory";
type MemoryTools = Pick<
  ReturnType<typeof mnemonicMemory.listTools>,
  EnabledMemoryToolName
>;

export type MnemonicUITools = InferToolActionUITools<MemoryTools>;
