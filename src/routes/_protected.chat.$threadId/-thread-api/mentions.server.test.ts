import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { note } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { createSafeId, toSafeId } from "@/lib/safe-id";
import { clearDatabase } from "@/test/clear-database";
import { expectOk } from "@/test/result";
import { seedFile, seedThread, seedTopic, seedUser } from "@/test/seed";

import { getMentionsFn, MENTIONS_QUERY_LIMIT } from "./mentions.server";

const ctx = Kit.createContext(dbKit, memoryKit);
const MINUTE_MS = 60 * 1000;

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();

const seedNote = async (input: {
  threadId?: string;
  title: string;
  topicId?: string;
  updatedAt?: Date;
}) =>
  expectOk(
    await ctx.db.run((db) =>
      db.insert(note).values({
        id: createSafeId<"note">(),
        threadId: input.threadId ?? null,
        title: input.title,
        // oxlint-disable-next-line eslint-js/no-restricted-syntax -- test seeder brands known inserted ids.
        topicId: input.topicId === undefined ? null : toSafeId<"topic">(input.topicId),
        updatedAt: input.updatedAt,
        userId,
      }),
    ),
  );

beforeEach(async () => {
  await seedUser({ id: userId });
  await seedTopic({ userId, id: topicId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("getMentionsFn", () => {
  it("returns files, notes and conversations of the topic for an empty query", async () => {
    const threadId = await seedThread({ resourceId: topicId, title: "Kickoff call" });
    await Promise.all([
      seedFile({ userId, topicId, displayName: "budget.pdf" }),
      seedNote({ title: "Topic note", topicId, updatedAt: new Date(Date.now() - MINUTE_MS) }),
      seedNote({
        title: "Thread note",
        threadId,
        updatedAt: new Date(Date.now() - 10 * MINUTE_MS),
      }),
    ]);

    const mentions = expectOk(await getMentionsFn(ctx, { query: undefined, threadId, userId }));

    expect(mentions).toEqual([
      expect.objectContaining({ displayName: "budget.pdf", type: "file" }),
      expect.objectContaining({ displayName: "Topic note", type: "note" }),
      expect.objectContaining({ displayName: "Thread note", type: "note" }),
      expect.objectContaining({ displayName: "Kickoff call", type: "thread" }),
    ]);
  });

  it("matches file names case-insensitively on a substring", async () => {
    const threadId = await seedThread({ resourceId: topicId, title: "Kickoff call" });
    await Promise.all([
      seedFile({ userId, topicId, displayName: "Quarterly Budget.pdf" }),
      seedFile({ userId, topicId, displayName: "roadmap.md" }),
    ]);

    const mentions = expectOk(await getMentionsFn(ctx, { query: "BUDGET", threadId, userId }));

    expect(mentions.map((mention) => mention.displayName)).toEqual(["Quarterly Budget.pdf"]);
  });

  it("orders files newest first", async () => {
    const threadId = await seedThread({ resourceId: topicId, title: "Kickoff call" });
    await Promise.all([
      seedFile({
        userId,
        topicId,
        displayName: "older.pdf",
        createdAt: new Date(Date.now() - 10 * MINUTE_MS),
      }),
      seedFile({
        userId,
        topicId,
        displayName: "newer.pdf",
        createdAt: new Date(Date.now() - MINUTE_MS),
      }),
    ]);

    const mentions = expectOk(await getMentionsFn(ctx, { query: "pdf", threadId, userId }));

    expect(mentions.map((mention) => mention.displayName)).toEqual(["newer.pdf", "older.pdf"]);
  });

  it("returns only the thread's own notes for a thread outside a topic", async () => {
    const threadId = await seedThread({ resourceId: userId, title: "Solo chat" });
    const otherThreadId = await seedThread({ resourceId: userId, title: "Other chat" });
    await Promise.all([
      seedNote({ title: "Solo note", threadId }),
      seedNote({ title: "Other note", threadId: otherThreadId }),
    ]);

    const mentions = expectOk(await getMentionsFn(ctx, { query: undefined, threadId, userId }));

    expect(mentions).toEqual([expect.objectContaining({ displayName: "Solo note", type: "note" })]);
  });

  it("offers the topic's shared notes but not a sibling thread's own notes", async () => {
    const [threadId, siblingThreadId] = await Promise.all([
      seedThread({ resourceId: topicId, title: "Kickoff call" }),
      seedThread({ resourceId: topicId, title: "Side chat" }),
    ]);
    await Promise.all([
      seedNote({ title: "Shared note", topicId }),
      seedNote({ title: "Sibling note", threadId: siblingThreadId }),
    ]);

    const mentions = expectOk(await getMentionsFn(ctx, { query: "note", threadId, userId }));

    expect(mentions).toEqual([
      expect.objectContaining({ displayName: "Shared note", type: "note" }),
    ]);
  });

  it("drops matching conversations once the topic has a full page of files", async () => {
    // Files are fetched with .limit(MENTIONS_QUERY_LIMIT) and the merged list is cut at that
    // same limit, so a topic with a full page of files can never surface a conversation mention.
    const threadId = await seedThread({ resourceId: topicId, title: "needle conversation" });
    await Promise.all(
      Array.from({ length: MENTIONS_QUERY_LIMIT }, async (_, index) =>
        seedFile({ userId, topicId, displayName: `needle-${String(index)}.pdf` }),
      ),
    );

    const mentions = expectOk(await getMentionsFn(ctx, { query: "needle", threadId, userId }));

    expect(mentions).toHaveLength(MENTIONS_QUERY_LIMIT);
    expect(mentions.every((mention) => mention.type === "file")).toBe(true);
  });
});
