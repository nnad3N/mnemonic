import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

import { Kit } from "@/lib/kit";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/file-rag-config";
import { pgVector } from "@/mastra/storage";

export class VectorError extends TaggedError("VectorError")<{
  cause: unknown;
  message: string;
}>() {}

const toVectorError = (cause: unknown): VectorError =>
  new VectorError({
    cause,
    message: "Vector operation failed",
  });

type DeleteVectorsParams = Parameters<typeof pgVector.deleteVectors>[0];

type DeleteVectorsInput = {
  filter: NonNullable<DeleteVectorsParams["filter"]>;
};

export type VectorApi = {
  deleteVectors: (input: DeleteVectorsInput) => Promise<ResultType<void, VectorError>>;
};

export const createVectorKit = (api: VectorApi) => Kit.define("vector", api);

export const vectorKit = createVectorKit({
  deleteVectors: async (input) =>
    Result.tryPromise({
      try: async () => {
        await pgVector.deleteVectors({
          indexName: FILE_EMBEDDINGS_INDEX,
          filter: input.filter,
        });
      },
      catch: toVectorError,
    }),
});

export type VectorKit = typeof vectorKit;
