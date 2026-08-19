import { extractBytes } from "@kreuzberg/node";
import { Result, TaggedError } from "better-result";

import type { DbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import type { Kits } from "@/lib/kit";
import type { S3Kit } from "@/lib/s3-kit.server";
import { toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";

export class GetFileError extends TaggedError("GetFileError")<{
  message: string;
}> {}

export type FetchedFile = {
  bytes: Uint8Array;
  displayName: string;
  fileId: string;
  mimeType: string;
  sizeBytes: number;
};

export type GetFileInput = {
  fileId: string;
  topicId: SafeId<"topic">;
};

export const toFileText = async (file: FetchedFile): Promise<Result<string, GetFileError>> =>
  Result.tryPromise({
    try: async () => {
      const extraction = await extractBytes(file.bytes, file.mimeType);
      return extraction.content;
    },
    catch: () =>
      new GetFileError({
        message: "File could not be loaded.",
      }),
  });

type GetFileCtx = Kits<[DbKit, S3Kit]>;

export const getFile = Kit.gen(async function* (ctx: GetFileCtx, input: GetFileInput) {
  const row = yield* await ctx.db.run((db) =>
    db.query.file.findFirst({
      columns: {
        displayName: true,
        id: true,
        mimeType: true,
        s3Key: true,
        sizeBytes: true,
        status: true,
      },
      where: {
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with topicId.
        id: toSafeId<"file">(input.fileId),
        topicId: input.topicId,
      },
    }),
  );

  if (!row || row.status !== "ready") {
    return Result.err(
      new GetFileError({
        message: "File not found.",
      }),
    );
  }

  const object = yield* await ctx.s3.getObject(row.s3Key);

  return Result.ok<FetchedFile>({
    bytes: object,
    displayName: row.displayName,
    fileId: row.id,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
  });
});
