import type { DataOmPart } from "@mastra/memory/processors";
import type { UIMessage, UIMessagePart, DataUIPart } from "ai";

import type { MnemonicUITools } from "@/mastra/mnemonic-tool-types";

type OmDataKey<P extends DataOmPart> = P["type"] extends `data-${infer K}`
  ? K
  : never;

export type ThreadUIDataTypes = {
  [P in DataOmPart as OmDataKey<P>]: Extract<
    DataOmPart,
    { type: P["type"] }
  >["data"];
};

export type ThreadUITools = MnemonicUITools;

export type ThreadUIMessage = UIMessage<
  unknown,
  ThreadUIDataTypes,
  ThreadUITools
>;

export type ThreadUIMessagePart = UIMessagePart<
  ThreadUIDataTypes,
  ThreadUITools
>;

export type ThreadDataUIPart = DataUIPart<ThreadUIDataTypes>;
