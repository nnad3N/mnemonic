import { exhaustiveArray } from "@/lib/types";
import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types";

export const KNOWN_TOOL_NAMES = exhaustiveArray<MnemonicToolName>()([
  "executeCode",
  "fileGraphRag",
  "fileVectorSearch",
  "getFile",
  "recall",
  "webFetch",
  "webSearch",
]);

export const isKnownToolName = (toolName: string): toolName is MnemonicToolName =>
  (KNOWN_TOOL_NAMES as readonly string[]).includes(toolName);
