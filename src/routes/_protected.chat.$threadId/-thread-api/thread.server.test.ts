import { generateText } from "ai";
import { Result } from "better-result";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { note } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { createMemoryKit, type MemoryApi, MemoryError, memoryKit } from "@/lib/memory-kit.server";
import type { ProviderKey } from "@/lib/middleware/resolve-provider-key.server";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { createVectorKit, type VectorApi, VectorError, vectorKit } from "@/lib/vector-kit.server";
import { EMBEDDING_DIMENSION } from "@/mastra/models.server";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";
import { clearDatabase } from "@/test/clear-database";
import { createFakeS3 } from "@/test/fake-s3";
import { expectErr, expectOk } from "@/test/result";
import { seedFile, seedThread, seedTopic, seedUser } from "@/test/seed";

import {
  createThreadTitleFn,
  createTopicFn,
  deleteConversationFn,
  deleteTopicFn,
  mergeConsecutiveAssistantMessages,
} from "./thread.server";

// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  return {
    ...actual,
    generateText: vi.fn<typeof generateText>(),
  };
});

const generateTextMock = vi.mocked(generateText);

const providerKey: ProviderKey = { key: "test-key", provider: "openrouter" };

const stubGeneratedTitle = (text: string) => {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- createThreadTitleFn only reads result.text
  generateTextMock.mockResolvedValue({ text } as Awaited<ReturnType<typeof generateText>>);
};

const db = Kit.get(dbKit);
const memory = Kit.get(memoryKit);
const vector = Kit.get(vectorKit);

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();
const fakeS3 = createFakeS3();

/** Non-zero unit vector — cosine similarity of the zero vector is undefined and filters out. */
const unitVector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => (index === 0 ? 1 : 0));

const upsertTopicVector = async (vectorTopicId: SafeId<"topic">, fileId: SafeId<"file">) => {
  expectOk(
    await vector.indexFile({
      chunks: [{ page: 1, text: "chunk" }],
      fileId,
      topicId: vectorTopicId,
      vectors: [unitVector],
    }),
  );
};

const vectorIdsForTopic = async (vectorTopicId: SafeId<"topic">) => {
  const results = expectOk(
    await vector.search({ scope: { topicId: vectorTopicId }, topK: 100, vector: unitVector }),
  );

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

const seedNote = async (input: { threadId?: string; title: string; topicId?: SafeId<"topic"> }) =>
  expectOk(
    await db.run((database) =>
      database.insert(note).values({
        id: createSafeId<"note">(),
        threadId: input.threadId ?? null,
        title: input.title,
        topicId: input.topicId ?? null,
        userId,
      }),
    ),
  );

const noteTitles = async () => {
  const result = await db.run((database) =>
    database.query.note.findMany({ columns: { title: true } }),
  );

  return expectOk(result).map((row) => row.title);
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

const createFailingMemoryKit = () => {
  const api: MemoryApi = {
    clearResourceObservations: memory.clearResourceObservations,
    deleteMessages: memory.deleteMessages,
    listThreads: memory.listThreads,
    deleteThread: async () =>
      Promise.resolve(
        Result.err(
          new MemoryError({
            message: "Failed to delete the thread",
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

describe("deleteTopicFn", () => {
  beforeEach(async () => {
    fakeS3.reset();
    await seedUser({ id: userId });
    await seedTopic({ userId, id: topicId });
  });

  afterEach(async () => {
    await clearDatabase();
  });

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

    expect(expectOk(await deleteTopicFn(ctx, { topicId, userId }))).toEqual({
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

    expectOk(await deleteTopicFn(ctx, { topicId, userId }));

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

    expectOk(await deleteTopicFn(ctx, { topicId, userId }));

    expect(await topicExists(siblingTopicId)).toBe(true);
    expect(await fileIdsForTopic(siblingTopicId)).toEqual([sibling.fileId]);
    expect(await vectorIdsForTopic(siblingTopicId)).toEqual([`${sibling.fileId}:0`]);
    expect(await threadIdsForResource(userId)).toEqual([standaloneThreadId]);
  });

  it("deletes the notes shared with the topic and those private to its threads", async () => {
    const [threadId, standaloneThreadId] = await Promise.all([
      seedThread({ resourceId: topicId }),
      seedThread({ resourceId: userId }),
    ]);
    await Promise.all([
      seedNote({ title: "Shared note", topicId }),
      seedNote({ title: "Private note", threadId }),
      seedNote({ title: "Standalone note", threadId: standaloneThreadId }),
    ]);
    const ctx = Kit.createContext(dbKit, fakeS3.kit, memoryKit, vectorKit);

    expectOk(await deleteTopicFn(ctx, { topicId, userId }));

    expect(await noteTitles()).toEqual(["Standalone note"]);
  });

  it("keeps the database rows when the object delete fails", async () => {
    const { fileId, s3Key } = await seedFile({ userId, topicId, status: "ready" });
    fakeS3.failingKeys.add(s3Key);
    fakeS3.put(s3Key, new TextEncoder().encode("kept"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, memoryKit, vectorKit);

    expectErr(await deleteTopicFn(ctx, { topicId, userId }));

    expect(await topicExists(topicId)).toBe(true);
    expect(await fileIdsForTopic(topicId)).toEqual([fileId]);
    expect(fakeS3.objects.has(s3Key)).toBe(true);
  });

  it("keeps the database rows when vector deletion fails", async () => {
    const { fileId, s3Key } = await seedFile({ userId, topicId, status: "ready" });
    fakeS3.put(s3Key, new TextEncoder().encode("kept"));
    const ctx = Kit.createContext(dbKit, fakeS3.kit, memoryKit, createFailingVectorKit());

    expectErr(await deleteTopicFn(ctx, { topicId, userId }));

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

    expectErr(await deleteTopicFn(ctx, { topicId, userId }));

    expect(await topicExists(topicId)).toBe(true);
    expect(await fileIdsForTopic(topicId)).toEqual([fileId]);
    expect(await threadIdsForResource(topicId)).toEqual([threadId]);
    // S3 and memory delete run concurrently; S3 may still succeed when memory fails.
    expect(fakeS3.objects.has(s3Key)).toBe(false);
  });
});

describe("deleteConversationFn", () => {
  beforeEach(async () => {
    await seedUser({ id: userId });
    await seedTopic({ userId, id: topicId });
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("deletes the notes private to the conversation and keeps those shared with the topic", async () => {
    const threadId = await seedThread({ resourceId: topicId });
    await Promise.all([
      seedNote({ title: "Private note", threadId }),
      seedNote({ title: "Shared note", topicId }),
    ]);
    const ctx = Kit.createContext(dbKit, memoryKit);

    expectOk(await deleteConversationFn(ctx, { threadId }));

    expect(await noteTitles()).toEqual(["Shared note"]);
  });
});

describe("createTopicFn", () => {
  beforeEach(async () => {
    await seedUser({ id: userId });
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("creates the first topic thread with an empty title", async () => {
    const ctx = Kit.createContext(dbKit, memoryKit);
    const { threadId } = expectOk(await createTopicFn(ctx, { title: "Research", userId }));

    const thread = expectOk(await memory.getThreadById({ threadId }));

    expect(thread?.title).toBe("");
  });
});

describe("createThreadTitleFn", () => {
  const titleCtx = Kit.createContext(memoryKit);

  beforeEach(async () => {
    await seedUser({ id: userId });
    generateTextMock.mockReset();
    stubGeneratedTitle("Generated Title");
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it("generates and writes a title when the thread is untitled", async () => {
    const threadId = await seedThread({ resourceId: userId, title: "" });

    const result = expectOk(
      await createThreadTitleFn(titleCtx, {
        metadata: {},
        providerKey,
        text: "Tell me about kumquats",
        threadId,
      }),
    );

    expect(result).toEqual({
      id: threadId,
      title: "Generated Title",
      updatedAt: expect.any(String),
    });
    expect(generateTextMock).toHaveBeenCalledOnce();
    expect(expectOk(await memory.getThreadById({ threadId }))?.title).toBe("Generated Title");
  });

  it("skips generation when the thread already has a title", async () => {
    const threadId = await seedThread({ resourceId: userId, title: "My Name" });

    const result = expectOk(
      await createThreadTitleFn(titleCtx, {
        metadata: {},
        providerKey,
        text: "Tell me about kumquats",
        threadId,
      }),
    );

    expect(result).toBeNull();
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(expectOk(await memory.getThreadById({ threadId }))?.title).toBe("My Name");
  });

  it("skips the write when the thread is renamed during generation", async () => {
    const threadId = await seedThread({ resourceId: userId, title: "" });

    generateTextMock.mockImplementation(async () => {
      expectOk(
        await memory.updateThread({
          id: threadId,
          metadata: {},
          title: "Renamed Mid Flight",
        }),
      );

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- createThreadTitleFn only reads result.text
      return { text: "Generated Title" } as Awaited<ReturnType<typeof generateText>>;
    });

    const result = expectOk(
      await createThreadTitleFn(titleCtx, {
        metadata: {},
        providerKey,
        text: "Tell me about kumquats",
        threadId,
      }),
    );

    expect(result).toBeNull();
    expect(generateTextMock).toHaveBeenCalledOnce();
    expect(expectOk(await memory.getThreadById({ threadId }))?.title).toBe("Renamed Mid Flight");
  });
});

const message = ({
  id,
  role,
  parts,
  metadata,
}: {
  id: string;
  role: ThreadUIMessage["role"];
  parts?: ThreadUIMessage["parts"];
  metadata?: ThreadUIMessage["metadata"];
}): ThreadUIMessage => ({
  id,
  role,
  parts: parts ?? [{ type: "text", text: id }],
  metadata,
});

describe("mergeConsecutiveAssistantMessages", () => {
  it("leaves a single assistant unchanged", () => {
    const messages = [
      message({ id: "u1", role: "user" }),
      message({ id: "a1", role: "assistant" }),
    ];

    expect(mergeConsecutiveAssistantMessages(messages)).toEqual(messages);
  });

  it("merges consecutive assistants after a user, keeping the last id and metadata and concatenating parts", () => {
    const firstParts: ThreadUIMessage["parts"] = [{ type: "text", text: "first" }];
    const secondParts: ThreadUIMessage["parts"] = [{ type: "text", text: "second" }];
    const messages = [
      message({ id: "u1", role: "user" }),
      message({ id: "a1", role: "assistant", parts: firstParts, metadata: { type: "assistant" } }),
      message({
        id: "a2",
        role: "assistant",
        parts: secondParts,
        metadata: { type: "assistant", workTimings: [{ startedAt: "2026-01-01T00:00:00.000Z" }] },
      }),
    ];

    expect(mergeConsecutiveAssistantMessages(messages)).toEqual([
      message({ id: "u1", role: "user" }),
      {
        id: "a2",
        role: "assistant",
        parts: firstParts.concat(secondParts),
        metadata: { type: "assistant", workTimings: [{ startedAt: "2026-01-01T00:00:00.000Z" }] },
      },
    ]);
  });

  it("does not merge assistants separated by a user", () => {
    const messages = [
      message({ id: "u1", role: "user" }),
      message({ id: "a1", role: "assistant" }),
      message({ id: "u2", role: "user" }),
      message({ id: "a2", role: "assistant" }),
    ];

    expect(mergeConsecutiveAssistantMessages(messages)).toEqual(messages);
  });

  it("merges more than two consecutive assistants", () => {
    const messages = [
      message({ id: "u1", role: "user" }),
      message({ id: "a1", role: "assistant", parts: [{ type: "text", text: "one" }] }),
      message({ id: "a2", role: "assistant", parts: [{ type: "text", text: "two" }] }),
      message({ id: "a3", role: "assistant", parts: [{ type: "text", text: "three" }] }),
    ];

    expect(mergeConsecutiveAssistantMessages(messages)).toEqual([
      message({ id: "u1", role: "user" }),
      {
        id: "a3",
        role: "assistant",
        parts: [
          { type: "text", text: "one" },
          { type: "text", text: "two" },
          { type: "text", text: "three" },
        ],
      },
    ]);
  });

  it("returns an empty list unchanged", () => {
    expect(mergeConsecutiveAssistantMessages([])).toEqual([]);
  });
});
