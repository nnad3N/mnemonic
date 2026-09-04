import { Result } from "better-result";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";

import { file } from "@/db/schema.server";
import { ilike } from "@/db/sql.server";
import type { DbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { S3Kit } from "@/lib/s3-kit.server";
import { rawId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import type { VectorKit } from "@/lib/vector-kit.server";
import { FILE_EMBEDDINGS_INDEX, FILE_EMBEDDINGS_INDEX_CONFIG } from "@/mastra/rag-config.server";
import {
  FILE_PROCESSING_TTL_SECONDS,
  FILE_UPLOAD_TTL_SECONDS,
} from "@/routes/_protected.chat.$threadId/-thread-api/files.server";

type DeleteFileCtx = Kits<[DbKit, S3Kit, VectorKit]>;

type DeleteFileInput = {
  fileId: SafeId<"file">;
  s3Key: string;
};

export const deleteFileFn = Kit.gen(async function* (ctx: DeleteFileCtx, input: DeleteFileInput) {
  // The index is only created on first successful embed; a delete before that would hit a missing table.
  yield* await ctx.vector.createIndex(FILE_EMBEDDINGS_INDEX_CONFIG);

  yield* await Kit.promiseAll([
    ctx.s3.deleteObject(input.s3Key),
    ctx.vector.deleteVectors({
      filter: { fileId: input.fileId },
      indexName: FILE_EMBEDDINGS_INDEX,
    }),
  ]);

  yield* await ctx.db.run((db) => db.delete(file).where(eq(file.id, input.fileId)));

  return Result.ok({ id: input.fileId });
});

export const listPendingFilesFn = Kit.gen(async function* (
  ctx: Kits<[DbKit]>,
  input: { topicId: SafeId<"topic"> },
) {
  const now = Temporal.Now.instant();
  const uploadCutoff = new Date(
    now.subtract({ seconds: FILE_UPLOAD_TTL_SECONDS }).epochMilliseconds,
  );
  const processingCutoff = new Date(
    now.subtract({ seconds: FILE_PROCESSING_TTL_SECONDS }).epochMilliseconds,
  );

  const pending = yield* await ctx.db.run(async (db) => {
    await db
      .update(file)
      .set({ status: "failed" })
      .where(
        and(
          eq(file.topicId, input.topicId),
          or(
            and(eq(file.status, "uploading"), lt(file.updatedAt, uploadCutoff)),
            and(eq(file.status, "processing"), lt(file.updatedAt, processingCutoff)),
          ),
        ),
      );

    return db
      .select({ id: file.id })
      .from(file)
      .where(
        and(eq(file.topicId, input.topicId), inArray(file.status, ["uploading", "processing"])),
      );
  });

  return Result.ok(pending.map((pendingFile) => ({ id: rawId(pendingFile.id) })));
});

type ListFilesInput = {
  page: number;
  pageSize: number;
  search: string | undefined;
  topicId: SafeId<"topic">;
};

export const listFilesFn = Kit.gen(async function* (ctx: Kits<[DbKit]>, input: ListFilesInput) {
  const whereClause = input.search
    ? and(eq(file.topicId, input.topicId), ilike(file.displayName, input.search))
    : eq(file.topicId, input.topicId);

  const listed = yield* await ctx.db.run(async (db) => {
    const [items, totalCount] = await Promise.all([
      db
        .select({
          createdAt: file.createdAt,
          displayName: file.displayName,
          id: file.id,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          status: file.status,
        })
        .from(file)
        .where(whereClause)
        .orderBy(desc(file.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      db.$count(file, whereClause),
    ]);

    return { items, totalCount };
  });

  return Result.ok(listed);
});
