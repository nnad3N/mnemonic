import { Result } from "better-result";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { S3Error } from "@/lib/s3-kit.server";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import { createVectorKit, VectorError, vectorKit } from "@/lib/vector-kit.server";
import type { VectorApi } from "@/lib/vector-kit.server";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/file-rag-config.server";
import { FILE_EMBEDDING_DIMENSION } from "@/mastra/file-rag-config.server";
import { libsqlVector } from "@/mastra/storage.server";
import { clearDatabase } from "@/test/clear-database";
import { createFakeS3 } from "@/test/fake-s3";
import { expectErr, expectOk } from "@/test/result";
import { seedFile, seedTopic, seedUser } from "@/test/seed";

import { deleteFileFn } from "./files.server";

const db = Kit.get(dbKit);
const vector = Kit.get(vectorKit);

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();
const fakeS3 = createFakeS3();

/** Non-zero unit vector — cosine similarity of the zero vector is undefined and filters out. */
const unitVector = Array.from({ length: FILE_EMBEDDING_DIMENSION }, (_, index) =>
  index === 0 ? 1 : 0,
);

const fileExists = async (fileId: string) => {
  const result = await db.run((database) =>
    database.query.file.findFirst({
      where: { id: toSafeId<"file">(fileId) },
      columns: { id: true },
    }),
  );

  return expectOk(result) !== undefined;
};

const upsertFileVector = async (fileId: string) => {
  expectOk(
    await vector.upsert({
      ids: [`${fileId}:0`],
      metadata: [{ fileId, text: "chunk" }],
      vectors: [unitVector],
    }),
  );
};

const vectorIdsForFile = async (fileId: string) => {
  const results = await libsqlVector.query({
    indexName: FILE_EMBEDDINGS_INDEX,
    queryVector: unitVector,
    topK: 100,
    filter: { fileId },
  });

  return results.map((result) => result.id);
};

const createFailingVectorKit = () => {
  const api: VectorApi = {
    createIndex: async () => Promise.resolve(Result.ok()),
    deleteVectors: async () =>
      Promise.resolve(
        Result.err(
          new VectorError({
            message: "Vector operation failed",
            cause: new Error("forced vector failure"),
          }),
        ),
      ),
    upsert: async () => Promise.resolve(Result.ok()),
  };

  return createVectorKit(api);
};

beforeEach(async () => {
  fakeS3.reset();
  await Promise.all([
    vector.createIndex({ dimension: FILE_EMBEDDING_DIMENSION }).then(expectOk),
    seedUser({ id: userId }),
  ]);
  await seedTopic({ userId, id: topicId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("deleteFileFn", () => {
  it("deletes the s3 object, matching vectors, and the row", async () => {
    const [{ fileId, s3Key }, other] = await Promise.all([
      seedFile({ userId, topicId, status: "ready" }),
      seedFile({ userId, topicId, status: "ready" }),
    ]);

    await Promise.all([upsertFileVector(fileId), upsertFileVector(other.fileId)]);
    expect(await vectorIdsForFile(fileId)).toEqual([`${fileId}:0`]);
    expect(await vectorIdsForFile(other.fileId)).toEqual([`${other.fileId}:0`]);

    fakeS3.put(s3Key, new TextEncoder().encode("payload"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, vectorKit);

    expectOk(await deleteFileFn(ctx, { fileId, s3Key }));

    expect(fakeS3.calls.map((call) => call.method)).toEqual(["deleteObject"]);
    expect(fakeS3.objects.has(s3Key)).toBe(false);
    expect(await fileExists(fileId)).toBe(false);
    expect(await vectorIdsForFile(fileId)).toEqual([]);
    expect(await vectorIdsForFile(other.fileId)).toEqual([`${other.fileId}:0`]);
  });

  it("leaves the row intact when s3 deletion fails", async () => {
    const { fileId, s3Key } = await seedFile({ userId, topicId, status: "ready" });
    fakeS3.failingKeys.add(s3Key);
    fakeS3.put(s3Key, new TextEncoder().encode("payload"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, vectorKit);

    const error = expectErr(await deleteFileFn(ctx, { fileId, s3Key }));

    expect(S3Error.is(error)).toBe(true);
    expect(await fileExists(fileId)).toBe(true);
  });

  it("leaves the row intact when vector deletion fails", async () => {
    const { fileId, s3Key } = await seedFile({ userId, topicId, status: "ready" });
    fakeS3.put(s3Key, new TextEncoder().encode("payload"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, createFailingVectorKit());

    const error = expectErr(await deleteFileFn(ctx, { fileId, s3Key }));

    expect(VectorError.is(error)).toBe(true);
    expect(await fileExists(fileId)).toBe(true);
    // S3 and vector delete run concurrently; S3 may still succeed when vector fails.
    expect(fakeS3.objects.has(s3Key)).toBe(false);
  });
});
