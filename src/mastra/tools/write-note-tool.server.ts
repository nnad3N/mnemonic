import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { matchError, Result } from "better-result";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { threadRun } from "@/db/schema.server";
import { dbKit, type DbKit } from "@/lib/db-kit.server";
import { ToolError } from "@/lib/errors/tool-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { memoryKit, type MemoryKit } from "@/lib/memory-kit.server";
import { rawId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { createNoteFn } from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

type CreateAgentNoteInput = {
  content: string;
  threadId: string;
  title: string;
  userId: SafeId<"user">;
};

type CreateAgentNoteCtx = Kits<[DbKit, MemoryKit]>;

export const createAgentNoteFn = Kit.gen(async function* (
  ctx: CreateAgentNoteCtx,
  input: CreateAgentNoteInput,
) {
  const { id, versionId } = yield* await createNoteFn(ctx, { ...input, author: "agent" });

  // Created in this run, so later writes in the same run overwrite version 1.
  yield* await ctx.db.transaction(async (tx) => {
    const run = await tx.query.threadRun.findFirst({
      where: { threadId: input.threadId },
      columns: { versionedNoteIds: true },
    });

    if (run) {
      await tx
        .update(threadRun)
        .set({ versionedNoteIds: [...run.versionedNoteIds, id] })
        .where(eq(threadRun.threadId, input.threadId));
    }
  });

  return Result.ok({ id, versionId });
});

const inputSchema = v.object({
  title: v.pipe(v.string(), v.nonEmpty()),
  content: v.string(),
});

export const writeNoteOutputSchema = v.object({
  type: v.literal("created"),
  noteId: v.string(),
  versionId: v.string(),
});

type WriteNoteOutput = v.InferOutput<typeof writeNoteOutputSchema>;

const noteToolCtx = Kit.createContext(dbKit, memoryKit);

export const writeNoteTool = createTool({
  id: "write-note",
  description: "Creates a note in the current conversation from markdown content.",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(writeNoteOutputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async ({ content, title }, context): Promise<WriteNoteOutput> => {
    const result = await createAgentNoteFn(noteToolCtx, {
      content,
      threadId: context.requestContext.get("threadId"),
      title,
      userId: context.requestContext.get("userId"),
    });

    if (Result.isError(result)) {
      return matchError(result.error, {
        DatabaseError: (cause) => {
          throw new ToolError({ message: "Note could not be created.", cause });
        },
      });
    }

    return {
      type: "created",
      noteId: rawId(result.value.id),
      versionId: rawId(result.value.versionId),
    };
  },
});
