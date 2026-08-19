import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { createSafeId } from "@/lib/safe-id";
import { clearDatabase } from "@/test/clear-database";
import { expectOk } from "@/test/result";
import { seedFile, seedThread, seedTopic, seedUser } from "@/test/seed";

import { getMentionsFn, MENTIONS_QUERY_LIMIT } from "./mentions.server";

const ctx = Kit.createContext(dbKit, memoryKit);
const MINUTE_MS = 60 * 1000;

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();

beforeEach(async () => {
  await seedUser({ id: userId });
  await seedTopic({ userId, id: topicId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("getMentionsFn", () => {
  it("returns files and conversations of the topic for an empty query", async () => {
    await Promise.all([
      seedFile({ userId, topicId, displayName: "budget.pdf" }),
      seedThread({ resourceId: topicId, title: "Kickoff call" }),
    ]);

    const mentions = expectOk(await getMentionsFn(ctx, { query: "", resourceId: topicId, userId }));

    expect(mentions).toEqual([
      expect.objectContaining({ displayName: "budget.pdf", type: "file" }),
      expect.objectContaining({ displayName: "Kickoff call", type: "thread" }),
    ]);
  });

  it("matches file names case-insensitively on a substring", async () => {
    await Promise.all([
      seedFile({ userId, topicId, displayName: "Quarterly Budget.pdf" }),
      seedFile({ userId, topicId, displayName: "roadmap.md" }),
    ]);

    const mentions = expectOk(
      await getMentionsFn(ctx, { query: "BUDGET", resourceId: topicId, userId }),
    );

    expect(mentions.map((mention) => mention.displayName)).toEqual(["Quarterly Budget.pdf"]);
  });

  it("orders files newest first", async () => {
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

    const mentions = expectOk(await getMentionsFn(ctx, { query: "", resourceId: topicId, userId }));

    expect(mentions.map((mention) => mention.displayName)).toEqual(["newer.pdf", "older.pdf"]);
  });

  it("returns nothing for a resource id that is not a topic", async () => {
    const standaloneThreadId = await seedThread({ resourceId: userId, title: "Solo chat" });

    const mentions = expectOk(
      await getMentionsFn(ctx, { query: "", resourceId: standaloneThreadId, userId }),
    );

    expect(mentions).toEqual([]);
  });

  it("drops matching conversations once the topic has a full page of files", async () => {
    // Files are fetched with .limit(MENTIONS_QUERY_LIMIT) and conversations are
    // only appended while the list is under that same limit, so a topic with a
    // full page of files can never surface a conversation mention.
    await Promise.all([
      ...Array.from({ length: MENTIONS_QUERY_LIMIT }, async (_, index) =>
        seedFile({ userId, topicId, displayName: `needle-${String(index)}.pdf` }),
      ),
      seedThread({ resourceId: topicId, title: "needle conversation" }),
    ]);

    const mentions = expectOk(
      await getMentionsFn(ctx, { query: "needle", resourceId: topicId, userId }),
    );

    expect(mentions).toHaveLength(MENTIONS_QUERY_LIMIT);
    expect(mentions.every((mention) => mention.type === "file")).toBe(true);
  });
});
