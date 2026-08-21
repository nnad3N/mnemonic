import { Result } from "better-result";
import { eq } from "drizzle-orm";

import { file } from "@/db/schema.server";
import type { DbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { S3Kit } from "@/lib/s3-kit.server";
import type { SafeId } from "@/lib/safe-id";
import type { VectorKit } from "@/lib/vector-kit.server";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/rag-config.server";

type DeleteFileCtx = Kits<[DbKit, S3Kit, VectorKit]>;

type DeleteFileInput = {
  fileId: SafeId<"file">;
  s3Key: string;
};

export const deleteFileFn = Kit.gen(async function* (ctx: DeleteFileCtx, input: DeleteFileInput) {
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
