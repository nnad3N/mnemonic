import * as Kit from "@/lib/kit";
import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types.server";

export const KnownToolName = Kit.literals.from<MnemonicToolName>()([
  "agent-reader",
  "agent-worker",
  "compute",
  "computeDocs",
  "fileVectorSearch",
  "listFiles",
  "readFile",
  "readNote",
  "recall",
  "searchFile",
  "searchFiles",
  "searchNotes",
  "updateNote",
  "webFetch",
  "webSearch",
  "createNote",
]);
