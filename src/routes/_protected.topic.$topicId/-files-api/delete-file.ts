import { createServerFn } from "@tanstack/react-start";
import { matchError, Result } from "better-result";
import { eq } from "drizzle-orm";

import { file } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import type { DbKit } from "@/lib/db-kit";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import type { ServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import { fileAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { s3Kit } from "@/lib/s3-kit";
import type { S3Kit } from "@/lib/s3-kit";
import type { SafeId } from "@/lib/safe-id";
import { vectorKit } from "@/lib/vector-kit";
import type { VectorKit } from "@/lib/vector-kit";

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
    }),
  ]);

  yield* await ctx.db.run((db) => db.delete(file).where(eq(file.id, input.fileId)));

  return Result.ok({ id: input.fileId });
});

const deleteFileCtx = Kit.createContext(dbKit, s3Kit, vectorKit);

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      deleteFileFn(deleteFileCtx, {
        fileId: context.file.id,
        s3Key: context.file.s3Key,
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Failed to delete file record"),
        S3Error: () => toServerFnError.serverError("Failed to delete file from S3"),
        VectorError: () => toServerFnError.serverError("Failed to delete file embedding"),
      }),
    ),
  );
