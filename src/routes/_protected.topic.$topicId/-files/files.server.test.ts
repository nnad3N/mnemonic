import { Result } from "better-result";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { S3Error } from "@/lib/s3-kit.server";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { createVectorKit, VectorError, vectorKit } from "@/lib/vector-kit.server";
import type { VectorApi } from "@/lib/vector-kit.server";
import { EMBEDDING_DIMENSION } from "@/mastra/models.server";
import {
  FILE_PROCESSING_TTL_SECONDS,
  FILE_UPLOAD_TTL_SECONDS,
} from "@/routes/_protected.chat.$threadId/-thread-api/files.server";
import { clearDatabase } from "@/test/clear-database";
import { createFakeS3 } from "@/test/fake-s3";
import { expectErr, expectOk } from "@/test/result";
import { seedFile, seedTopic, seedUser } from "@/test/seed";

import { deleteFileFn, listFilesFn, listPendingFilesFn } from "./files.server";

const db = Kit.get(dbKit);
const vector = Kit.get(vectorKit);

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();
const fakeS3 = createFakeS3();

/** Non-zero unit vector — cosine similarity of the zero vector is undefined and filters out. */
const unitVector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => (index === 0 ? 1 : 0));

const fileExists = async (fileId: string) => {
  const result = await db.run((database) =>
    database.query.file.findFirst({
      where: { id: toSafeId<"file">(fileId) },
      columns: { id: true },
    }),
  );

  return expectOk(result) !== undefined;
};

const fileStatus = async (fileId: string) => {
  const result = await db.run((database) =>
    database.query.file.findFirst({
      where: { id: toSafeId<"file">(fileId) },
      columns: { status: true },
    }),
  );

  return expectOk(result)?.status;
};

const secondsAgo = (seconds: number) => new Date(Date.now() - seconds * 1000);

const upsertFileVector = async (fileId: SafeId<"file">) => {
  expectOk(
    await vector.indexFile({
      chunks: [{ page: 1, text: "chunk" }],
      fileId,
      topicId,
      vectors: [unitVector],
    }),
  );
};

const vectorIdsForFile = async (fileId: SafeId<"file">) => {
  const results = expectOk(
    await vector.search({ scope: { fileId }, topK: 100, vector: unitVector }),
  );

  return results.map((result) => result.id);
};

const createFailingVectorKit = () => {
  const api: VectorApi = {
    forget: async () =>
      Promise.resolve(
        Result.err(
          new VectorError({
            message: "Failed to delete file embeddings",
            cause: new Error("forced vector failure"),
          }),
        ),
      ),
    indexFile: async () => Promise.resolve(Result.ok()),
    search: async () => Promise.resolve(Result.ok([])),
  };

  return createVectorKit(api);
};

beforeEach(async () => {
  fakeS3.reset();
  await seedUser({ id: userId });
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

describe("listPendingFilesFn", () => {
  it("fails uploads and processing past their TTL and lists what is still pending", async () => {
    const ctx = Kit.createContext(dbKit);
    const [staleUpload, staleProcessing, fresh, ready] = await Promise.all([
      seedFile({
        userId,
        topicId,
        status: "uploading",
        updatedAt: secondsAgo(FILE_UPLOAD_TTL_SECONDS + 1),
      }),
      seedFile({
        userId,
        topicId,
        status: "processing",
        updatedAt: secondsAgo(FILE_PROCESSING_TTL_SECONDS + 1),
      }),
      seedFile({
        userId,
        topicId,
        status: "processing",
        updatedAt: secondsAgo(FILE_UPLOAD_TTL_SECONDS + 1),
      }),
      seedFile({ userId, topicId, status: "ready" }),
    ]);

    const pending = expectOk(await listPendingFilesFn(ctx, { topicId }));

    expect(pending).toEqual([{ id: fresh.fileId }]);
    expect(await fileStatus(staleUpload.fileId)).toBe("failed");
    expect(await fileStatus(staleProcessing.fileId)).toBe("failed");
    expect(await fileStatus(ready.fileId)).toBe("ready");
  });
});

describe("listFilesFn", () => {
  it("pages newest first and filters by display name", async () => {
    const ctx = Kit.createContext(dbKit);
    const [oldest, middle, newest] = await Promise.all([
      seedFile({ userId, topicId, displayName: "report-q1.pdf", createdAt: secondsAgo(30) }),
      seedFile({ userId, topicId, displayName: "notes.txt", createdAt: secondsAgo(20) }),
      seedFile({ userId, topicId, displayName: "report-q2.pdf", createdAt: secondsAgo(10) }),
    ]);

    const firstPage = expectOk(
      await listFilesFn(ctx, { page: 1, pageSize: 2, search: undefined, topicId }),
    );
    const reports = expectOk(
      await listFilesFn(ctx, { page: 1, pageSize: 10, search: "report", topicId }),
    );

    expect(firstPage.totalCount).toBe(3);
    expect(firstPage.items.map((item) => item.id)).toEqual([newest.fileId, middle.fileId]);
    expect(reports.items.map((item) => item.id)).toEqual([newest.fileId, oldest.fileId]);
  });
});
