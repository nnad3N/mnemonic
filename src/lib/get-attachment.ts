import { Result, TaggedError } from "better-result";
import * as v from "valibot";

import { decodeBase64DataUrl } from "@/lib/base64";
import type { FetchedFile } from "@/lib/get-file";
import { hashBytes } from "@/lib/hash";
import type { Kits } from "@/lib/kit";
import * as Kit from "@/lib/kit";
import type { MemoryKit } from "@/lib/memory-kit";
import { threadMessageMetadataSchema } from "@/routes/_protected.chat.$threadId/-thread-types";

export class GetAttachmentError extends TaggedError("GetAttachmentError")<{
  message: string;
}>() {}

type GetAttachmentInput = {
  flushMessages?: () => Promise<void>;
  sha256: string;
  threadId: string;
};

type GetAttachmentCtx = Kits<[MemoryKit]>;

const getMessageAttachments = (metadata: unknown) => {
  const parsed = v.safeParse(threadMessageMetadataSchema, metadata);

  if (!parsed.success) {
    return [];
  }

  return parsed.output.attachments;
};

export const getAttachment = Kit.gen(async function* (
  ctx: GetAttachmentCtx,
  input: GetAttachmentInput,
) {
  // OM defers persistence until turn end; flush so same-turn attachments exist in storage.
  if (input.flushMessages) {
    await Result.tryPromise({
      try: input.flushMessages,
      catch: () => new GetAttachmentError({ message: "File not found." }),
    });
  }

  const listed = yield* await ctx.memory.listMessages({
    threadId: input.threadId,
    page: 0,
    perPage: false,
  });

  for (const message of listed.messages) {
    if (message.role !== "user") {
      continue;
    }

    const attachments = getMessageAttachments(message.content.metadata);

    for (const part of message.content.parts) {
      if (part.type !== "file") {
        continue;
      }

      const bytes = decodeBase64DataUrl(part.data);

      if (bytes === null) {
        continue;
      }

      const sha256 = await hashBytes(bytes);

      if (sha256 !== input.sha256) {
        continue;
      }

      const attachment = attachments?.find((attachment) => attachment.sha256 === input.sha256);

      if (!attachment) {
        return Result.err(
          new GetAttachmentError({
            message: "File not found.",
          }),
        );
      }

      return Result.ok<FetchedFile>({
        bytes,
        displayName: attachment.filename,
        fileId: input.sha256,
        mimeType: attachment.mediaType,
        sizeBytes: bytes.byteLength,
      });
    }
  }

  return Result.err(
    new GetAttachmentError({
      message: "File not found.",
    }),
  );
});
