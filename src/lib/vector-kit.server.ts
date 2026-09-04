import type { QueryResult } from "@mastra/core/vector";
import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

import * as Kit from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";
import { EMBEDDING_DIMENSION } from "@/mastra/models.server";
import { mastraVector } from "@/mastra/storage.server";

// Bump the suffix whenever the embedding model or dimension changes: pgvector cannot hold two
// dimensions in one index, and nothing else re-embeds existing files.
export const FILE_EMBEDDINGS_INDEX = "file_embeddings_v001";

export class VectorError extends TaggedError("VectorError")<{
  cause: unknown;
  message: string;
}> {}

export type FileChunk = {
  page?: number;
  text: string;
};

type IndexFileInput = {
  chunks: FileChunk[];
  fileId: SafeId<"file">;
  topicId: SafeId<"topic">;
  vectors: number[][];
};

export type VectorScope = { fileId: SafeId<"file"> } | { topicId: SafeId<"topic"> };

type SearchInput = {
  scope: VectorScope;
  topK: number;
  vector: number[];
};

export type VectorApi = {
  forget: (scope: VectorScope) => Promise<ResultType<void, VectorError>>;
  indexFile: (input: IndexFileInput) => Promise<ResultType<void, VectorError>>;
  search: (input: SearchInput) => Promise<ResultType<QueryResult[], VectorError>>;
};

export const createVectorKit = (api: VectorApi) => Kit.define("vector", api);

// The index only exists once something was embedded; a delete or query may come first.
const ensureIndex = async () =>
  mastraVector.createIndex({
    dimension: EMBEDDING_DIMENSION,
    indexConfig: { type: "hnsw" },
    indexName: FILE_EMBEDDINGS_INDEX,
  });

export const vectorKit = createVectorKit({
  forget: async (scope) =>
    Result.tryPromise({
      try: async () => {
        await ensureIndex();
        await mastraVector.deleteVectors({ filter: scope, indexName: FILE_EMBEDDINGS_INDEX });
      },
      catch: (cause) => new VectorError({ cause, message: "Failed to delete embeddings" }),
    }),
  indexFile: async (input) =>
    Result.tryPromise({
      try: async () => {
        await ensureIndex();
        await mastraVector.deleteVectors({
          filter: { fileId: input.fileId },
          indexName: FILE_EMBEDDINGS_INDEX,
        });
        await mastraVector.upsert({
          ids: input.chunks.map((_, index) => `${input.fileId}:${index}`),
          indexName: FILE_EMBEDDINGS_INDEX,
          metadata: input.chunks.map((chunk, index) => ({
            chunkIndex: index,
            fileId: input.fileId,
            page: chunk.page,
            text: chunk.text,
            topicId: input.topicId,
          })),
          vectors: input.vectors,
        });
      },
      catch: (cause) => new VectorError({ cause, message: "Failed to index the file embeddings" }),
    }),
  search: async (input) =>
    Result.tryPromise({
      try: async () => {
        await ensureIndex();

        return mastraVector.query({
          filter: input.scope,
          indexName: FILE_EMBEDDINGS_INDEX,
          queryVector: input.vector,
          topK: input.topK,
        });
      },
      catch: (cause) => new VectorError({ cause, message: "Failed to search embeddings" }),
    }),
});

export type VectorKit = typeof vectorKit;
