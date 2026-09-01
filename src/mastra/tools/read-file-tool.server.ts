import type { ToolResultOutput } from "@ai-sdk/provider-utils";
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { panic, Result } from "better-result";
import * as v from "valibot";

import { ToolError } from "@/lib/errors/tool-error";
import { ImageMimeType, PDF_MIME_TYPE } from "@/lib/file-validation";
import { mentionKeyFormat } from "@/lib/mention-key";
import {
  modelAcceptsPdf,
  ModelAgentIds,
  models,
  SUBAGENT_MODEL,
  WORKER_AGENT_ID,
} from "@/mastra/models.server";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import {
  extractFile,
  loadMentionedFile,
  visualSchema,
} from "@/mastra/tools/file-tool-helpers.server";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";

const inputSchema = v.object({
  fileKey: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.description(
      `Mention key of the file, in the shape ${mentionKeyFormat(["file", "attachment"])}.`,
    ),
  ),
});

const outputSchema = v.variant("type", [
  v.object({
    type: v.literal("whole"),
    displayName: v.pipe(v.string(), v.nonEmpty()),
    data: v.pipe(v.string(), v.nonEmpty(), v.description("Base64.")),
    mimeType: v.pipe(v.string(), v.nonEmpty()),
  }),
  v.object({
    type: v.literal("parsed"),
    displayName: v.pipe(v.string(), v.nonEmpty()),
    text: v.string(),
    visuals: v.array(visualSchema),
    skipped: v.pipe(v.number(), v.description("Embedded images in formats the model cannot view.")),
  }),
  v.object({
    type: v.literal("error"),
    message: v.string(),
  }),
]);

type ReadFileOutput = v.InferOutput<typeof outputSchema>;

const toModelOutput = (output: ReadFileOutput): ToolResultOutput => {
  if (output.type === "error") {
    return { type: "text", value: output.message };
  }

  if (output.type === "whole") {
    return {
      type: "content",
      value: [
        {
          type: "file",
          mediaType: output.mimeType,
          filename: output.displayName,
          data: { type: "data", data: output.data },
        },
      ],
    };
  }

  return {
    type: "content",
    value: [
      { type: "text", text: output.text },
      ...output.visuals.flatMap((visual) => [
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
    ],
  };
};

export const readFileTool = createTool({
  id: "read-file",
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  description:
    "Reads one file whole when the model can view that format directly, otherwise as its text plus the images inside it.",
  execute: async ({ fileKey }, context): Promise<ReadFileOutput> => {
    const agentId = context.agent?.agentId;

    if (!ModelAgentIds.is(agentId)) {
      panic(`Unknown agent ${agentId} for read-file`);
    }

    const modelOption = context.requestContext.get("modelOption");

    const file = await loadMentionedFile({ fileKey, requestContext: context.requestContext });

    if (Result.isError(file)) {
      return { type: "error", message: file.error.message };
    }

    const { bytes, displayName, mimeType } = file.value;

    const agentModel = agentId === WORKER_AGENT_ID ? SUBAGENT_MODEL : models[modelOption].model;

    const viewable =
      ImageMimeType.is(mimeType) || (mimeType === PDF_MIME_TYPE && modelAcceptsPdf(agentModel));

    if (viewable) {
      return {
        type: "whole",
        displayName,
        data: Buffer.from(bytes).toString("base64"),
        mimeType,
      };
    }

    const extracted = await extractFile(bytes, mimeType);

    if (Result.isError(extracted)) {
      throw new ToolError({
        message: "File contents could not be extracted.",
        cause: extracted.error,
      });
    }

    return { type: "parsed", displayName, ...extracted.value };
  },
  toModelOutput,
});
