import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

import * as Kit from "@/lib/kit";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/file-rag-config.server";
import { libsqlVector } from "@/mastra/storage.server";

export class VectorError extends TaggedError("VectorError")<{
  cause: unknown;
  message: string;
}> {}

type DeleteVectorsParams = Parameters<typeof libsqlVector.deleteVectors>[0];
type CreateIndexInput = Omit<Parameters<typeof libsqlVector.createIndex>[0], "indexName">;
type UpsertInput = Omit<Parameters<typeof libsqlVector.upsert>[0], "indexName">;

type DeleteVectorsInput = {
  filter: NonNullable<DeleteVectorsParams["filter"]>;
};

export type VectorApi = {
  createIndex: (input: CreateIndexInput) => Promise<ResultType<void, VectorError>>;
  deleteVectors: (input: DeleteVectorsInput) => Promise<ResultType<void, VectorError>>;
  upsert: (input: UpsertInput) => Promise<ResultType<void, VectorError>>;
};

export const createVectorKit = (api: VectorApi) => Kit.define("vector", api);

export const vectorKit = createVectorKit({
  createIndex: async (input) =>
    Result.tryPromise({
      try: async () => {
        await libsqlVector.createIndex({
          ...input,
          indexName: FILE_EMBEDDINGS_INDEX,
        });
      },
      catch: (cause) =>
        new VectorError({ cause, message: "Failed to create the file embeddings index" }),
    }),
  deleteVectors: async (input) =>
    Result.tryPromise({
      try: async () => {
        await libsqlVector.deleteVectors({
          indexName: FILE_EMBEDDINGS_INDEX,
          filter: input.filter,
        });
      },
      catch: (cause) => new VectorError({ cause, message: "Failed to delete file embeddings" }),
    }),
  upsert: async (input) =>
    Result.tryPromise({
      try: async () => {
        await libsqlVector.upsert({
          ...input,
          indexName: FILE_EMBEDDINGS_INDEX,
        });
      },
      catch: (cause) => new VectorError({ cause, message: "Failed to upsert file embeddings" }),
    }),
});

export type VectorKit = typeof vectorKit;
