import * as Kit from "@/lib/kit";
import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types";

export const KnownToolName = Kit.literals.from<MnemonicToolName>()([
  "executeCode",
  "fileGraphRag",
  "fileVectorSearch",
  "getFile",
  "recall",
  "webFetch",
  "webSearch",
]);
