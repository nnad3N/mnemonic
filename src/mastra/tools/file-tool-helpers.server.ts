import { detectMimeType, extractBytes } from "@kreuzberg/node";
import type { RequestContext } from "@mastra/core/request-context";
import { matchError, panic, Result } from "better-result";
import * as v from "valibot";

import { dbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import { ImageMimeType } from "@/lib/file-validation";
import { getAttachment, GetAttachmentError } from "@/lib/get-attachment.server";
import type { FetchedFile } from "@/lib/get-file.server";
import { getFile, GetFileError } from "@/lib/get-file.server";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { parseMentionKey } from "@/lib/mention-key";
import { s3Kit } from "@/lib/s3-kit.server";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";

const getFileCtx = Kit.createContext(dbKit, s3Kit);
const getAttachmentCtx = Kit.createContext(memoryKit);

type LoadMentionedFileInput = {
  fileKey: string;
  requestContext: RequestContext<MnemonicRequestContext> | undefined;
};

/**
 * Loads a topic file or a conversation attachment by its mention key. A file the model cannot
 * have is a normal `Err` for the tool to report; an infrastructure failure throws `ToolError`.
 */
export const loadMentionedFile = async ({
  fileKey,
  requestContext,
}: LoadMentionedFileInput): Promise<Result<FetchedFile, GetFileError | GetAttachmentError>> => {
  const mention = parseMentionKey(fileKey);

  if (mention.type === "file") {
    const topicId = requestContext?.get("filter")?.topicId;

    if (!topicId) {
      panic("Missing topicId in request context");
    }

    const result = await getFile(getFileCtx, { fileId: mention.value, topicId });

    if (Result.isError(result)) {
      return matchError(result.error, {
        GetFileError: (error) => Result.err(error),
        DatabaseError: (cause) => {
          throw new ToolError({ message: "File could not be loaded.", cause });
        },
        S3Error: (cause) => {
          throw new ToolError({ message: "File could not be loaded.", cause });
        },
      });
    }

    return Result.ok(result.value);
  }

  if (mention.type === "attachment") {
    const threadId = requestContext?.get("threadId");

    if (!threadId) {
      panic("Missing threadId in request context");
    }

    const result = await getAttachment(getAttachmentCtx, { sha256: mention.value, threadId });

    if (Result.isError(result)) {
      return matchError(result.error, {
        GetAttachmentError: (error) => Result.err(error),
        MemoryError: (cause) => {
          throw new ToolError({ message: "File could not be loaded.", cause });
        },
      });
    }

    return Result.ok(result.value);
  }

  return Result.err(new GetFileError({ message: `"${fileKey}" is not a usable file reference.` }));
};

export const visualSchema = v.object({
  data: v.pipe(v.string(), v.nonEmpty(), v.description("Base64.")),
  mimeType: v.pipe(v.string(), v.nonEmpty()),
  page: v.optional(v.number()),
});

type Visual = v.InferOutput<typeof visualSchema>;

export const extractFile = async (bytes: Uint8Array, mimeType: string) => {
  const extraction = await Result.tryPromise(async () =>
    extractBytes(Buffer.from(bytes), mimeType, { images: { extractImages: true } }),
  );

  if (Result.isError(extraction)) {
    return Result.err(extraction.error);
  }

  const visuals: Visual[] = [];
  let skipped = 0;

  for (const image of extraction.value.images ?? []) {
    const imageMimeType = detectMimeType(Buffer.from(image.data));

    if (!ImageMimeType.is(imageMimeType)) {
      skipped += 1;
      continue;
    }

    visuals.push({
      data: Buffer.from(image.data).toString("base64"),
      mimeType: imageMimeType,
      page: image.pageNumber ?? undefined,
    });
  }

  return Result.ok({ text: extraction.value.content, visuals, skipped });
};
