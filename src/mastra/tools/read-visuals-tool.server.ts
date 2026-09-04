import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { DownloadError, downloadBlob } from "@ai-sdk/provider-utils";
import { detectMimeType } from "@kreuzberg/node";
import type { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import type { UnhandledException } from "better-result";
import { Result } from "better-result";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import { ImageMimeType } from "@/lib/file-validation";
import type { GetAttachmentError } from "@/lib/get-attachment.server";
import { GetFileError } from "@/lib/get-file.server";
import { mentionKeyFormat } from "@/lib/mention-key";
import type { MnemonicRequestContext } from "@/mastra/request-context.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import {
  extractFile,
  loadMentionedFile,
  visualSchema,
} from "@/mastra/tools/file-tool-helpers.server";

const DOWNLOAD_TIMEOUT_MS = 30_000;
const DOWNLOAD_RETRY_DELAY_MS = 500;

const isTransientDownloadError = ({ cause }: UnhandledException) => {
  if (!DownloadError.isInstance(cause)) {
    return false;
  }

  if (cause.statusCode === undefined) {
    return true;
  }

  return cause.statusCode === 429 || cause.statusCode >= 500;
};

const inputSchema = v.object({
  fileKey: v.optional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description(
        `Mention key of the file, in the shape ${mentionKeyFormat(["file", "attachment"])}. Pass this or \`url\`.`,
      ),
    ),
  ),
  url: v.optional(
    v.pipe(
      v.string(),
      v.url(),
      v.description(
        "Link to the file itself, not to a page that displays it. Pass this or `fileKey`.",
      ),
    ),
  ),
});

type ReadVisualsInput = v.InferOutput<typeof inputSchema>;

const outputSchema = v.variant("type", [
  v.object({
    type: v.literal("visuals"),
    displayName: v.pipe(v.string(), v.nonEmpty()),
    visuals: v.array(visualSchema),
    skipped: v.pipe(v.number(), v.description("Embedded images in formats the model cannot view.")),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type ReadVisualsOutput = v.InferOutput<typeof outputSchema>;

type VisualSource = {
  bytes: Uint8Array;
  displayName: string;
  mimeType: string;
};

type LoadSourceInput = {
  abortSignal: AbortSignal | undefined;
  input: ReadVisualsInput;
  requestContext: RequestContext<MnemonicRequestContext> | undefined;
};

const loadSource = async ({
  abortSignal,
  input,
  requestContext,
}: LoadSourceInput): Promise<Result<VisualSource, GetFileError | GetAttachmentError>> => {
  if (input.fileKey) {
    const file = await loadMentionedFile({ fileKey: input.fileKey, requestContext });

    if (Result.isError(file)) {
      return Result.err(file.error);
    }

    const { bytes, displayName, mimeType } = file.value;

    return Result.ok({ bytes, displayName, mimeType });
  }

  const url = input.url;

  if (!url) {
    return Result.err(new GetFileError({ message: "Pass either a fileKey or a url." }));
  }

  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);

  const blob = await Result.tryPromise(
    async ({ signal }) => downloadBlob(url, { abortSignal: signal }),
    {
      signal: abortSignal ? AbortSignal.any([timeout, abortSignal]) : timeout,
      retry: {
        times: 2,
        delayMs: DOWNLOAD_RETRY_DELAY_MS,
        backoff: "exponential",
        shouldRetry: isTransientDownloadError,
      },
    },
  );

  if (Result.isError(blob)) {
    return Result.err(new GetFileError({ message: `"${url}" could not be downloaded.` }));
  }

  const bytes = Buffer.from(await blob.value.arrayBuffer());

  return Result.ok({ bytes, displayName: url, mimeType: detectMimeType(bytes) });
};

const toModelOutput = (output: ReadVisualsOutput): ToolResultOutput => {
  if (output.type === "error") {
    return { type: "text", value: output.message };
  }

  if (output.visuals.length === 0) {
    return {
      type: "text",
      value:
        output.skipped === 0
          ? `${output.displayName} contains no images.`
          : `${output.displayName} contains ${output.skipped} image(s), none in a viewable format.`,
    };
  }

  return {
    type: "content",
    value: output.visuals.flatMap((visual) => [
      ...(visual.page === undefined
        ? []
        : [{ type: "text" as const, text: `Page ${visual.page}:` }]),
      {
        type: "file" as const,
        mediaType: visual.mimeType,
        filename: output.displayName,
        data: { type: "data" as const, data: visual.data },
      },
    ]),
  };
};

export const readVisualsTool = createTool({
  id: "read-visuals",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description: "Reads the images in one file or at one URL; an image comes back as itself.",
  execute: async (input, { abortSignal, requestContext }): Promise<ReadVisualsOutput> => {
    const source = await loadSource({
      abortSignal,
      input,
      requestContext,
    });

    if (Result.isError(source)) {
      return { type: "error", message: source.error.message };
    }

    const { bytes, displayName, mimeType } = source.value;

    if (ImageMimeType.is(mimeType)) {
      return {
        type: "visuals",
        displayName,
        visuals: [{ data: Buffer.from(bytes).toString("base64"), mimeType }],
        skipped: 0,
      };
    }

    const extracted = await extractFile(bytes, mimeType);

    if (Result.isError(extracted)) {
      throw new ToolError({
        message: "File contents could not be extracted.",
        cause: extracted.error,
      });
    }

    return { type: "visuals", displayName, ...extracted.value };
  },
  toModelOutput,
});
