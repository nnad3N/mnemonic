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
import { memoryKit } from "@/lib/memory-kit.server";
import { rawId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { mnemonicRequestContextSchema } from "@/mastra/request-context.server";
import { appendVersionedNoteId } from "@/mastra/tools/note-tool-helpers.server";
import { insertNote } from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

type CreateAgentNoteInput = {
  content: string;
  threadId: string;
  title: string;
  userId: SafeId<"user">;
};

export const createAgentNoteFn = Kit.gen(async function* (
  ctx: Kits<[DbKit]>,
  input: CreateAgentNoteInput,
) {
  const created = yield* await ctx.db.transaction(async (tx) => {
    const { id, versionId } = await insertNote(tx, { ...input, author: "agent" });

    // Created in this run, so later writes in the same run overwrite version 1.
    await tx
      .update(threadRun)
      .set({ versionedNoteIds: appendVersionedNoteId(id) })
      .where(eq(threadRun.threadId, input.threadId));

    return { id, versionId };
  });

  return Result.ok(created);
});

const inputSchema = v.object({
  title: v.pipe(v.string(), v.nonEmpty()),
  content: v.string(),
});

export const createNoteOutputSchema = v.object({
  type: v.literal("created"),
  noteId: v.pipe(v.string(), v.nanoid()),
  versionId: v.pipe(v.string(), v.nanoid()),
});

type CreateNoteOutput = v.InferOutput<typeof createNoteOutputSchema>;

const noteToolCtx = Kit.createContext(dbKit, memoryKit);

export const createNoteTool = createTool({
  id: "create-note",
  description: "Creates a note in the current conversation from markdown content.",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(createNoteOutputSchema),
  requestContextSchema: toStandardJsonSchema(mnemonicRequestContextSchema),
  execute: async ({ content, title }, context): Promise<CreateNoteOutput> => {
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
