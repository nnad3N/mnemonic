import { noopLogger } from "@mastra/core/logger";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit";
import * as Kit from "@/lib/kit";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import { vectorKit } from "@/lib/vector-kit";
import { FILE_EMBEDDINGS_INDEX } from "@/mastra/file-rag-config";
import { FILE_EMBEDDING_DIMENSION } from "@/mastra/models";
import { libsqlVector } from "@/mastra/storage";
import { clearDatabase } from "@/test/clear-database";
import { createFakeS3 } from "@/test/fake-s3";
import ragSampleXml from "@/test/fixtures/rag-sample.xml?raw";
import { expectErr, expectOk } from "@/test/result";
import { seedFile, seedByok, seedTopic, seedUser } from "@/test/seed";

import {
  FileProcessingError,
  processFileWorkflow,
  processForRagFn,
  validateFileFn,
} from "./upload-file-workflow";

// oxlint-disable-next-line no-underscore-dangle
processFileWorkflow.__setLogger(noopLogger);
const XML_MIME = "application/xml";
const RAG_SAMPLE_PHRASE = "Mnemonic RAG sample paragraph";

/** Non-zero unit vector — cosine similarity of the zero vector is undefined and filters out. */
const unitVector = Array.from({ length: FILE_EMBEDDING_DIMENSION }, (_, index) =>
  index === 0 ? 1 : 0,
);

const db = Kit.get(dbKit);

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();
const fakeS3 = createFakeS3();
const ctx = Kit.createContext(dbKit, fakeS3.kit, vectorKit);

const getFileStatus = async (fileId: string) => {
  const result = await db.run((database) =>
    database.query.file.findFirst({
      where: { id: toSafeId<"file">(fileId) },
      columns: { status: true },
    }),
  );

  return expectOk(result)?.status;
};

const vectorsForFile = async (fileId: string) => {
  const results = await libsqlVector.query({
    indexName: FILE_EMBEDDINGS_INDEX,
    queryVector: unitVector,
    topK: 100,
    filter: { fileId },
  });

  return results;
};

beforeEach(async () => {
  fakeS3.reset();
  await seedUser({ id: userId });
  await seedTopic({ userId, id: topicId });
  await seedByok({ userId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("validateFileFn", () => {
  it("rejects when the file row is missing", async () => {
    const error = expectErr(
      await validateFileFn(ctx, {
        fileId: "V1StGXR8_Z5jdHi6B-myT",
        topicId,
        userId,
      }),
    );

    expect(FileProcessingError.is(error)).toBe(true);
    expect(error).toMatchObject({ reason: "file-not-found" });
  });

  it("rejects when status is not uploading and leaves status unchanged", async () => {
    const { fileId, s3Key } = await seedFile({
      userId,
      topicId,
      status: "ready",
      sizeBytes: 4,
    });
    fakeS3.put(s3Key, new TextEncoder().encode("test"));

    const error = expectErr(await validateFileFn(ctx, { fileId, topicId, userId }));

    expect(FileProcessingError.is(error)).toBe(true);
    expect(error).toMatchObject({ reason: "invalid-status" });
    expect(await getFileStatus(fileId)).toBe("ready");
  });

  it("rejects when s3 size mismatches and leaves status uploading", async () => {
    const { fileId, s3Key } = await seedFile({
      userId,
      topicId,
      status: "uploading",
      sizeBytes: 100,
    });
    fakeS3.put(s3Key, new TextEncoder().encode("short"));

    const error = expectErr(await validateFileFn(ctx, { fileId, topicId, userId }));

    expect(FileProcessingError.is(error)).toBe(true);
    expect(error).toMatchObject({ reason: "size-mismatch" });
    expect(await getFileStatus(fileId)).toBe("uploading");
  });

  it("transitions uploading to processing when validation passes", async () => {
    const body = new TextEncoder().encode("hello");
    const { fileId, s3Key } = await seedFile({
      userId,
      topicId,
      status: "uploading",
      sizeBytes: body.byteLength,
      displayName: "hello.txt",
      mimeType: "text/plain",
    });
    fakeS3.put(s3Key, body);

    const value = expectOk(await validateFileFn(ctx, { fileId, topicId, userId }));

    expect(value).toEqual({
      topicId,
      fileId,
      userId,
      displayName: "hello.txt",
      mimeType: "text/plain",
      s3Key,
    });
    expect(await getFileStatus(fileId)).toBe("processing");
  });
});

describe("processForRagFn", () => {
  it("marks images ready without reading the object", async () => {
    const { fileId, s3Key } = await seedFile({
      userId,
      topicId,
      status: "processing",
      mimeType: "image/png",
      displayName: "shot.png",
    });

    expectOk(
      await processForRagFn(ctx, {
        fileId,
        topicId,
        userId,
        displayName: "shot.png",
        mimeType: "image/png",
        s3Key,
      }),
    );

    expect(fakeS3.calls).toEqual([]);
    expect(await getFileStatus(fileId)).toBe("ready");
  });

  it("marks ready when extraction yields no chunks", async () => {
    const body = new Uint8Array();
    const { fileId, s3Key } = await seedFile({
      userId,
      topicId,
      status: "processing",
      mimeType: "text/plain",
      sizeBytes: 0,
      displayName: "empty.txt",
    });
    fakeS3.put(s3Key, body);

    expectOk(
      await processForRagFn(ctx, {
        fileId,
        topicId,
        userId,
        displayName: "empty.txt",
        mimeType: "text/plain",
        s3Key,
      }),
    );

    expect(fakeS3.calls.map((call) => call.method)).toEqual(["getObject"]);
    expect(await getFileStatus(fileId)).toBe("ready");
  });

  it("fails when bytes do not match the declared mime type and leaves status processing", async () => {
    const body = new TextEncoder().encode("%PDF-not-really");
    const { fileId, s3Key } = await seedFile({
      userId,
      topicId,
      status: "processing",
      mimeType: "application/pdf",
      sizeBytes: body.byteLength,
      displayName: "broken.pdf",
    });
    fakeS3.put(s3Key, body);

    expectErr(
      await processForRagFn(ctx, {
        fileId,
        topicId,
        userId,
        displayName: "broken.pdf",
        mimeType: "application/pdf",
        s3Key,
      }),
    );

    expect(await getFileStatus(fileId)).toBe("processing");
  });

  it("extracts xml, embeds chunks, upserts vectors, and marks ready", async () => {
    const body = new TextEncoder().encode(ragSampleXml);
    const { fileId, s3Key } = await seedFile({
      userId,
      topicId,
      status: "processing",
      mimeType: XML_MIME,
      sizeBytes: body.byteLength,
      displayName: "rag-sample.xml",
    });
    fakeS3.put(s3Key, body);

    expectOk(
      await processForRagFn(ctx, {
        fileId,
        topicId,
        userId,
        displayName: "rag-sample.xml",
        mimeType: XML_MIME,
        s3Key,
      }),
    );

    expect(fakeS3.calls.map((call) => call.method)).toEqual(["getObject"]);
    expect(await getFileStatus(fileId)).toBe("ready");

    const vectors = await vectorsForFile(fileId);
    expect(vectors.map((hit) => hit.id)).toEqual([`${fileId}:0`]);
    expect(vectors.at(0)?.metadata).toMatchObject({
      topicId,
      fileId,
      chunkIndex: 0,
      displayName: "rag-sample.xml",
    });
    expect(String(vectors.at(0)?.metadata?.text ?? "")).toContain(RAG_SAMPLE_PHRASE);
  });
});

describe("processFileWorkflow", () => {
  it("marks the file failed when a step throws", async () => {
    const { fileId } = await seedFile({
      userId,
      topicId,
      status: "processing",
    });

    const run = await processFileWorkflow.createRun();
    const result = await run.start({
      inputData: {
        fileId,
        topicId,
        userId,
      },
    });

    expect(result.status).toBe("failed");
    expect(await getFileStatus(fileId)).toBe("failed");
  });

  it("does not clobber a ready file when a duplicate run fails validation", async () => {
    const { fileId } = await seedFile({
      userId,
      topicId,
      status: "ready",
    });

    const run = await processFileWorkflow.createRun();
    const result = await run.start({
      inputData: {
        fileId,
        topicId,
        userId,
      },
    });

    expect(result.status).toBe("failed");
    expect(await getFileStatus(fileId)).toBe("ready");
  });
});
