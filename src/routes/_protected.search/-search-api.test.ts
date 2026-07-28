import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit";
import { Kit } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import { createSafeId } from "@/lib/safe-id";
import { expectOk } from "@/test/result";
import { clearDatabase, seedThread, seedTopic, seedUser } from "@/test/seed";

import { searchItemsFn } from "./-search-api";

const searchCtx = Kit.createContext(dbKit, memoryKit);
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const userId = createSafeId<"user">();

beforeEach(async () => {
  await seedUser({ id: userId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("searchItemsFn", () => {
  it("filters topics by title query", async () => {
    const [matching] = await Promise.all([
      seedTopic({ userId, title: "Quantum notes" }),
      seedTopic({ userId, title: "Cooking" }),
    ]);

    const result = expectOk(await searchItemsFn(searchCtx, { query: "quantum", userId }));

    expect(result.topics.map((topic) => topic.id)).toEqual([matching]);
  });

  it("includes a topic when only a nested conversation matches", async () => {
    const topicId = await seedTopic({ userId, title: "Unrelated topic" });
    const threadId = await seedThread({
      resourceId: topicId,
      title: "Needle conversation",
    });

    const result = expectOk(await searchItemsFn(searchCtx, { query: "needle", userId }));

    expect(result.topics).toHaveLength(1);
    expect(result.topics.at(0)?.id).toBe(topicId);
    expect(result.topics.at(0)?.conversations.map((item) => item.id)).toEqual([threadId]);
  });

  it("returns standalone conversations newest-first", async () => {
    const older = new Date(Date.now() - 2 * HOUR_MS);
    const newer = new Date(Date.now() - 30 * MINUTE_MS);

    const [olderId, newerId] = await Promise.all([
      seedThread({
        resourceId: userId,
        title: "Alpha",
        createdAt: older,
        updatedAt: older,
      }),
      seedThread({
        resourceId: userId,
        title: "Beta",
        createdAt: newer,
        updatedAt: newer,
      }),
    ]);

    const result = expectOk(await searchItemsFn(searchCtx, { query: "", userId }));

    expect(result.conversations.map((item) => item.id)).toEqual([newerId, olderId]);
  });
});
