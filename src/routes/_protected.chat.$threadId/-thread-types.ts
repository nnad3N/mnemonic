import type { DataOmPart } from "@mastra/memory/processors";
import type { UIMessage, UIMessagePart, DataUIPart } from "ai";
import * as v from "valibot";

import type { MnemonicUITools } from "@/mastra/mnemonic-tool-types.server";

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

export const userMessageMetadataSchema = v.object({
  type: v.literal("user"),
  attachments: v.optional(v.array(threadMetadataAttachmentSchema)),
});

/**
 * One stretch of work in a reply (server clock): opened by its first reasoning or tool call and
 * closed when a text part begins streaming or the run finishes, aborts or fails. Left open while
 * the work is still going.
 */
export const workTimingSchema = v.object({
  startedAt: v.string(),
  endedAt: v.optional(v.string()),
});

/**
 * Streamed as message metadata while the run is live and written to the last fragment once it
 * settles, so both read the same way. Text-only replies record no work.
 */
export const assistantMessageMetadataSchema = v.object({
  type: v.literal("assistant"),
  workTimings: v.optional(v.array(workTimingSchema)),
});

export const threadMessageMetadataSchema = v.variant("type", [
  userMessageMetadataSchema,
  assistantMessageMetadataSchema,
]);

export type ThreadMetadataAttachment = v.InferOutput<typeof threadMetadataAttachmentSchema>;

export type UserMessageMetadata = v.InferOutput<typeof userMessageMetadataSchema>;

export type WorkTiming = v.InferOutput<typeof workTimingSchema>;

export type AssistantMessageMetadata = v.InferOutput<typeof assistantMessageMetadataSchema>;

export type ThreadMessageMetadata = v.InferOutput<typeof threadMessageMetadataSchema>;

export type ThreadUIMessage = UIMessage<ThreadMessageMetadata, ThreadUIDataTypes, ThreadUITools>;

export type ThreadUIMessagePart = UIMessagePart<ThreadUIDataTypes, ThreadUITools>;

export type ThreadDataUIPart = DataUIPart<ThreadUIDataTypes>;
