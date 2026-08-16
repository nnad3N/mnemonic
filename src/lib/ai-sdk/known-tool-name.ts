import * as Kit from "@/lib/kit";
import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types.server";

export const KnownToolName = Kit.literals.from<MnemonicToolName>()([
  "agent-webResearch",
  "docs",
  "executeCode",
  "fileGraphRag",
  "fileVectorSearch",
  "getFile",
  "recall",
  "webFetch",
  "webSearch",
]);
