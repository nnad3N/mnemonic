import { Result } from "better-result";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit";
import * as Kit from "@/lib/kit";
import { createMemoryKit, type MemoryApi, MemoryError, memoryKit } from "@/lib/memory-kit";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import { createVectorKit, type VectorApi, VectorError, vectorKit } from "@/lib/vector-kit";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/file-rag-config";
import { FILE_EMBEDDING_DIMENSION } from "@/mastra/models";
import { libsqlVector } from "@/mastra/storage";
import { clearDatabase } from "@/test/clear-database";
import { createFakeS3 } from "@/test/fake-s3";
import { expectErr, expectOk } from "@/test/result";
import { seedFile, seedThread, seedTopic, seedUser } from "@/test/seed";

import { deleteTopicFn } from "./delete-thread";

const db = Kit.get(dbKit);
const memory = Kit.get(memoryKit);
const vector = Kit.get(vectorKit);

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();
const fakeS3 = createFakeS3();

/** Non-zero unit vector — cosine similarity of the zero vector is undefined and filters out. */
const unitVector = Array.from({ length: FILE_EMBEDDING_DIMENSION }, (_, index) =>
  index === 0 ? 1 : 0,
);

const upsertTopicVector = async (vectorTopicId: string, fileId: string) => {
  const result = await vector.upsert({
    ids: [`${fileId}:0`],
    metadata: [{ fileId, topicId: vectorTopicId, text: "chunk" }],
    vectors: [unitVector],
  });

  if (Result.isError(result)) {
    throw result.error;
  }
};

const vectorIdsForTopic = async (vectorTopicId: string) => {
  const results = await libsqlVector.query({
    indexName: FILE_EMBEDDINGS_INDEX,
    queryVector: unitVector,
    topK: 100,
    filter: { topicId: vectorTopicId },
  });

  return results.map((result) => result.id);
};

const topicExists = async (id: string) => {
  const result = await db.run((database) =>
    database.query.topic.findFirst({
      where: { id: toSafeId<"topic">(id) },
      columns: { id: true },
    }),
  );

  return expectOk(result) !== undefined;
};

const fileIdsForTopic = async (id: string) => {
  const result = await db.run((database) =>
    database.query.file.findMany({
      where: { topicId: toSafeId<"topic">(id) },
      columns: { id: true },
    }),
  );

  return expectOk(result).map((row) => row.id);
};

const threadIdsForResource = async (resourceId: string) => {
  const result = await memory.listThreads({
    filter: { resourceId },
    page: 0,
    perPage: false,
  });

  return expectOk(result).threads.map((thread) => thread.id);
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

const createFailingMemoryKit = () => {
  const api: MemoryApi = {
    clearResourceObservations: memory.clearResourceObservations,
    deleteMessages: memory.deleteMessages,
    listThreads: memory.listThreads,
    deleteThread: async () =>
      Promise.resolve(
        Result.err(
          new MemoryError({
            message: "Memory operation failed",
            cause: new Error("forced memory failure"),
          }),
        ),
      ),
    getThreadById: memory.getThreadById,
    listMessages: memory.listMessages,
    saveMessages: memory.saveMessages,
    saveThread: memory.saveThread,
    updateThread: memory.updateThread,
  };

  return createMemoryKit(api);
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

describe("deleteTopicFn", () => {
  it("removes the topic row, its files, its objects, its vectors, and its threads", async () => {
    const [first, second] = await Promise.all([
      seedFile({ userId, topicId, status: "ready" }),
      seedFile({ userId, topicId, status: "ready" }),
      seedThread({ resourceId: topicId }),
    ]);

    await Promise.all([
      upsertTopicVector(topicId, first.fileId),
      upsertTopicVector(topicId, second.fileId),
    ]);
    expect(await vectorIdsForTopic(topicId)).toHaveLength(2);

    fakeS3.put(first.s3Key, new TextEncoder().encode("one"));
    fakeS3.put(second.s3Key, new TextEncoder().encode("two"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, memoryKit, vectorKit);

    expect(expectOk(await deleteTopicFn(ctx, { topicId }))).toEqual({
      id: topicId,
    });

    expect(await topicExists(topicId)).toBe(false);
    expect(await fileIdsForTopic(topicId)).toEqual([]);
    expect(fakeS3.objects.size).toBe(0);
    expect(await vectorIdsForTopic(topicId)).toEqual([]);
    expect(await threadIdsForResource(topicId)).toEqual([]);
  });

  it("deletes the objects of the topic in one batched call", async () => {
    const [first, second] = await Promise.all([
      seedFile({ userId, topicId, status: "ready" }),
      seedFile({ userId, topicId, status: "ready" }),
    ]);
    const ctx = Kit.createContext(dbKit, fakeS3.kit, memoryKit, vectorKit);

    expectOk(await deleteTopicFn(ctx, { topicId }));

    expect(fakeS3.calls).toEqual([
      { method: "deleteObjects", keys: expect.arrayContaining([first.s3Key, second.s3Key]) },
    ]);
  });

  it("leaves a sibling topic and a standalone conversation untouched", async () => {
    const siblingTopicId = await seedTopic({ userId });
    const [sibling, , standaloneThreadId] = await Promise.all([
      seedFile({ userId, topicId: siblingTopicId, status: "ready" }),
      seedFile({ userId, topicId, status: "ready" }),
      seedThread({ resourceId: userId }),
    ]);

    await upsertTopicVector(siblingTopicId, sibling.fileId);

    const ctx = Kit.createContext(dbKit, fakeS3.kit, memoryKit, vectorKit);

    expectOk(await deleteTopicFn(ctx, { topicId }));

    expect(await topicExists(siblingTopicId)).toBe(true);
    expect(await fileIdsForTopic(siblingTopicId)).toEqual([sibling.fileId]);
    expect(await vectorIdsForTopic(siblingTopicId)).toEqual([`${sibling.fileId}:0`]);
    expect(await threadIdsForResource(userId)).toEqual([standaloneThreadId]);
  });

  it("keeps the database rows when the object delete fails", async () => {
    const { fileId, s3Key } = await seedFile({ userId, topicId, status: "ready" });
    fakeS3.failingKeys.add(s3Key);
    fakeS3.put(s3Key, new TextEncoder().encode("kept"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, memoryKit, vectorKit);

    expectErr(await deleteTopicFn(ctx, { topicId }));

    expect(await topicExists(topicId)).toBe(true);
    expect(await fileIdsForTopic(topicId)).toEqual([fileId]);
    expect(fakeS3.objects.has(s3Key)).toBe(true);
  });

  it("keeps the database rows when vector deletion fails", async () => {
    const { fileId, s3Key } = await seedFile({ userId, topicId, status: "ready" });
    fakeS3.put(s3Key, new TextEncoder().encode("kept"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, memoryKit, createFailingVectorKit());

    expectErr(await deleteTopicFn(ctx, { topicId }));

    expect(await topicExists(topicId)).toBe(true);
    expect(await fileIdsForTopic(topicId)).toEqual([fileId]);
    // S3 and vector delete run concurrently; S3 may still succeed when vector fails.
    expect(fakeS3.objects.has(s3Key)).toBe(false);
  });

  it("keeps the database rows when memory deletion fails", async () => {
    const [{ fileId, s3Key }, threadId] = await Promise.all([
      seedFile({ userId, topicId, status: "ready" }),
      seedThread({ resourceId: topicId }),
    ]);
    fakeS3.put(s3Key, new TextEncoder().encode("kept"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, createFailingMemoryKit(), vectorKit);

    expectErr(await deleteTopicFn(ctx, { topicId }));

    expect(await topicExists(topicId)).toBe(true);
    expect(await fileIdsForTopic(topicId)).toEqual([fileId]);
    expect(await threadIdsForResource(topicId)).toEqual([threadId]);
    // S3 and memory delete run concurrently; S3 may still succeed when memory fails.
    expect(fakeS3.objects.has(s3Key)).toBe(false);
  });
});
