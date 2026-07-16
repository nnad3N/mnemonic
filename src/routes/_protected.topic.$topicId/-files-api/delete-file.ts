import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import { eq } from "drizzle-orm";

import { file } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { fileAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { s3Kit } from "@/lib/s3-kit";
import type { S3Kit } from "@/lib/s3-kit";
import type { SafeId } from "@/lib/safe-id";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/file-rag-config";
import { pgVector } from "@/mastra/storage";

type DeleteFileCtx = Kits<[DbKit, S3Kit]>;

type DeleteFileInput = {
  fileId: SafeId<"file">;
  s3Key: string;
};

const deleteFileFn = Kit.gen(async function* (
  ctx: DeleteFileCtx,
  input: DeleteFileInput
) {
  const [deleteFileResult, deleteFileEmbeddingResult] = await Promise.all([
    ctx.s3.deleteObject(input.s3Key),
    Result.tryPromise(async () =>
      pgVector.deleteVectors({
        indexName: FILE_EMBEDDINGS_INDEX,
        filter: { fileId: input.fileId },
      })
    ),
  ]);
  yield* deleteFileResult;
  yield* deleteFileEmbeddingResult;

  yield* await ctx.db.run((db) =>
    db.delete(file).where(eq(file.id, input.fileId))
  );

  return Result.ok({ id: input.fileId });
});

const deleteFileCtx = Kit.createContext(dbKit, s3Kit);

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) => {
    const input = {
      fileId: context.file.id,
      s3Key: context.file.s3Key,
    };

    return Kit.serverFn(deleteFileFn, {
      DatabaseError: () =>
        toServerFnError.serverError("Failed to delete file record"),
      S3Error: () =>
        toServerFnError.serverError("Failed to delete file from S3"),
      UnhandledException: () =>
        toServerFnError.serverError("Failed to delete file embedding"),
    })(deleteFileCtx, input);
  });
