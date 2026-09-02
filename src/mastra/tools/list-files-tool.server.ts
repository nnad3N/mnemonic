import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { panic, Result } from "better-result";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";

import { file, filePage } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import { getMentionKey } from "@/lib/mention-key";
import { rawId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";

const outputSchema = v.object({
  files: v.array(
    v.object({
      fileKey: v.string(),
      displayName: v.string(),
      mimeType: v.string(),
      sizeBytes: v.number(),
      pageCount: v.number(),
      description: v.nullable(v.string()),
    }),
  ),
});

export const listFilesTool = createTool({
  id: "list-files",
  description:
    "Lists the files in the current topic with a one-sentence description of each. Files still processing are left out.",
  inputSchema: toStandardJsonSchema(v.object({})),
  outputSchema: toStandardJsonSchema(outputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async (_input, { requestContext }) => {
    const topicId = requestContext.get("filter")?.topicId;

    if (!topicId) {
      panic("Missing topicId in request context");
    }

    const result = await Kit.get(dbKit).run((db) =>
      db
        .select({
          description: file.description,
          displayName: file.displayName,
          id: file.id,
          mimeType: file.mimeType,
          pageCount: db.$count(filePage, eq(filePage.fileId, file.id)),
          sizeBytes: file.sizeBytes,
        })
        .from(file)
        .where(and(eq(file.topicId, topicId), eq(file.status, "ready")))
        .orderBy(desc(file.createdAt)),
    );

    if (Result.isError(result)) {
      throw new ToolError({ message: "Files could not be listed.", cause: result.error });
    }

    return {
      files: result.value.map(({ id, ...row }) => ({
        ...row,
        fileKey: getMentionKey({ type: "file", value: rawId(id) }),
      })),
    };
  },
});
