import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

import * as Kit from "@/lib/kit";
import { libsqlVector } from "@/mastra/storage.server";

export class VectorError extends TaggedError("VectorError")<{
  cause: unknown;
  message: string;
}> {}

type DeleteVectorsParams = Parameters<typeof libsqlVector.deleteVectors>[0];
type CreateIndexInput = Parameters<typeof libsqlVector.createIndex>[0];
type UpsertInput = Parameters<typeof libsqlVector.upsert>[0];

type DeleteVectorsInput = {
  filter: NonNullable<DeleteVectorsParams["filter"]>;
  indexName: string;
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
        await libsqlVector.createIndex(input);
      },
      catch: (cause) =>
        new VectorError({ cause, message: "Failed to create the embeddings index" }),
    }),
  deleteVectors: async (input) =>
    Result.tryPromise({
      try: async () => {
        await libsqlVector.deleteVectors(input);
      },
      catch: (cause) => new VectorError({ cause, message: "Failed to delete embeddings" }),
    }),
  upsert: async (input) =>
    Result.tryPromise({
      try: async () => {
        await libsqlVector.upsert(input);
      },
      catch: (cause) => new VectorError({ cause, message: "Failed to upsert embeddings" }),
    }),
});

export type VectorKit = typeof vectorKit;
