import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit";
import { FileUploadError } from "@/lib/errors/file-upload-error";
import { UPLOAD_MAX_BYTES } from "@/lib/file-validation";
import { Kit, ServerFnError } from "@/lib/kit";
import { createSafeId, type SafeId } from "@/lib/safe-id";
import { createFakeS3 } from "@/test/fake-s3";
import { expectErr, expectOk } from "@/test/result";
import { clearDatabase, seedFile, seedTopic, seedUser } from "@/test/seed";

import { getPresignedUrlFn } from "./upload-file";

const db = Kit.get(dbKit);
const SHA256 = "a".repeat(64);

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();
const fakeS3 = createFakeS3();
const ctx = Kit.createContext(dbKit, fakeS3.kit);

/** Scoped by topic to match the file_topic_sha256_unique index. */
const findFileBySha256 = async (id: SafeId<"topic">, sha256: string) => {
  const result = await db.run((database) =>
    database.query.file.findFirst({
      where: { sha256, topicId: id },
      columns: {
        displayName: true,
        id: true,
        mimeType: true,
        s3Key: true,
        sizeBytes: true,
        status: true,
      },
    }),
  );

  return expectOk(result);
};

type UploadOverrides = {
  displayName?: string;
  mimeType?: string;
  sha256?: string;
  sizeBytes?: number;
};

const uploadInput = (overrides: UploadOverrides = {}) => ({
  displayName: overrides.displayName ?? "notes.txt",
  fileId: "V1StGXR8_Z5jdHi6B-myT",
  mimeType: overrides.mimeType ?? "text/plain",
  sha256: overrides.sha256 ?? SHA256,
  sizeBytes: overrides.sizeBytes ?? 12,
});

beforeEach(async () => {
  fakeS3.reset();
  await seedUser({ id: userId });
  await seedTopic({ userId, id: topicId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("getPresignedUrlFn", () => {
  it("inserts an uploading row and presigns a put url for a new file", async () => {
    const value = expectOk(
      await getPresignedUrlFn(ctx, { ...uploadInput(), resourceId: topicId, userId }),
    );

    const s3Key = `${userId}/${topicId}/V1StGXR8_Z5jdHi6B-myT`;
    expect(value).toEqual({ type: "upload", presignedUrl: `https://s3.test/put/${s3Key}` });
    expect(await findFileBySha256(topicId, SHA256)).toMatchObject({
      displayName: "notes.txt",
      s3Key,
      status: "uploading",
    });
  });

  it("skips the upload when the same bytes are already processing", async () => {
    const sha256 = "processing".padEnd(64, "0");
    await seedFile({ userId, topicId, sha256, status: "processing" });

    const value = expectOk(
      await getPresignedUrlFn(ctx, { ...uploadInput({ sha256 }), resourceId: topicId, userId }),
    );

    expect(value).toEqual({ type: "skipped" });
    expect(fakeS3.calls).toEqual([]);
    expect(await findFileBySha256(topicId, sha256)).toMatchObject({ status: "processing" });
  });

  it("skips the upload when the same bytes are already ready", async () => {
    const sha256 = "ready".padEnd(64, "0");
    await seedFile({ userId, topicId, sha256, status: "ready" });

    const value = expectOk(
      await getPresignedUrlFn(ctx, { ...uploadInput({ sha256 }), resourceId: topicId, userId }),
    );

    expect(value).toEqual({ type: "skipped" });
    expect(fakeS3.calls).toEqual([]);
    expect(await findFileBySha256(topicId, sha256)).toMatchObject({ status: "ready" });
  });

  it("reuses the existing key and resets to uploading after a failed upload", async () => {
    const sha256 = "f".repeat(64);
    const { s3Key } = await seedFile({ userId, topicId, sha256, status: "failed" });

    const value = expectOk(
      await getPresignedUrlFn(ctx, { ...uploadInput({ sha256 }), resourceId: topicId, userId }),
    );

    expect(value).toEqual({ type: "upload", presignedUrl: `https://s3.test/put/${s3Key}` });
    expect(await findFileBySha256(topicId, sha256)).toMatchObject({ s3Key, status: "uploading" });
  });

  it("keeps the original display name when the same bytes are re-uploaded", async () => {
    // Current behavior: retrying only flips status, so a rename between
    // attempts is discarded and the sidebar keeps showing the first name.
    const sha256 = "b".repeat(64);
    await seedFile({ userId, topicId, sha256, status: "failed", displayName: "first-name.pdf" });

    expectOk(
      await getPresignedUrlFn(ctx, {
        ...uploadInput({ sha256, displayName: "renamed.pdf" }),
        resourceId: topicId,
        userId,
      }),
    );

    expect(await findFileBySha256(topicId, sha256)).toMatchObject({
      displayName: "first-name.pdf",
    });
  });

  it("rejects unsupported and oversized files before touching the database", async () => {
    const unsupported = expectErr(
      await getPresignedUrlFn(ctx, {
        ...uploadInput({ mimeType: "application/x-unknown" }),
        resourceId: topicId,
        userId,
      }),
    );
    const tooLarge = expectErr(
      await getPresignedUrlFn(ctx, {
        ...uploadInput({ sizeBytes: UPLOAD_MAX_BYTES + 1 }),
        resourceId: topicId,
        userId,
      }),
    );

    expect(FileUploadError.is(unsupported)).toBe(true);
    expect(unsupported).toMatchObject({ reason: "unsupported-mime-type" });
    expect(tooLarge).toMatchObject({ reason: "file-too-large" });
    expect(await findFileBySha256(topicId, SHA256)).toBeUndefined();
    expect(fakeS3.calls).toEqual([]);
  });

  it("reports a bad request when the thread is not inside a topic", async () => {
    const error = expectErr(
      await getPresignedUrlFn(ctx, {
        ...uploadInput(),
        resourceId: "Uakgb_J5m9g-0JDMbcJqL",
        userId,
      }),
    );

    expect(ServerFnError.is(error)).toBe(true);
    expect(error).toMatchObject({ status: "bad-request" });
    expect(fakeS3.calls).toEqual([]);
  });
});
