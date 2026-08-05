import type { DataOmPart } from "@mastra/memory/processors";
import type { UIMessage, UIMessagePart, DataUIPart } from "ai";
import * as v from "valibot";

import type { MnemonicUITools } from "@/mastra/mnemonic-tool-types";

type OmDataKey<P extends DataOmPart> = P["type"] extends `data-${infer K}` ? K : never;

export type ThreadUIDataTypes = {
  [P in DataOmPart as OmDataKey<P>]: Extract<DataOmPart, { type: P["type"] }>["data"];
};

export type ThreadUITools = MnemonicUITools;

export const threadMetadataAttachmentSchema = v.object({
  filename: v.pipe(v.string(), v.nonEmpty()),
  mediaType: v.pipe(v.string(), v.nonEmpty()),
  sha256: v.pipe(v.string(), v.length(64)),
});

export const threadMessageMetadataSchema = v.object({
  attachments: v.optional(v.array(threadMetadataAttachmentSchema)),
});

export type ThreadMetadataAttachment = v.InferOutput<typeof threadMetadataAttachmentSchema>;

export type ThreadMessageMetadata = v.InferOutput<typeof threadMessageMetadataSchema>;

export type ThreadUIMessage = UIMessage<ThreadMessageMetadata, ThreadUIDataTypes, ThreadUITools>;

export type ThreadUIMessagePart = UIMessagePart<ThreadUIDataTypes, ThreadUITools>;

export type ThreadDataUIPart = DataUIPart<ThreadUIDataTypes>;
