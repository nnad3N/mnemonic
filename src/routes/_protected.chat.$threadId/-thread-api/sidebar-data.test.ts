import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit";
import { Kit } from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import { createSafeId } from "@/lib/safe-id";
import { expectOk } from "@/test/result";
import { clearDatabase, seedThread, seedTopic, seedUser } from "@/test/seed";

import {
  getSidebarTopicsPageRequest,
  listSidebarConversationsFn,
  listSidebarTopicsFn,
} from "./sidebar-data";

const sidebarCtx = Kit.createContext(dbKit, memoryKit);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const userId = createSafeId<"user">();

beforeEach(async () => {
  await seedUser({ id: userId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("getSidebarTopicsPageRequest", () => {
  it("tiles consecutive pages without gaps or overlaps", () => {
    expect(getSidebarTopicsPageRequest(0).offset).toBe(0);

    for (let pageIndex = 0; pageIndex < 6; pageIndex += 1) {
      const current = getSidebarTopicsPageRequest(pageIndex);
      const next = getSidebarTopicsPageRequest(pageIndex + 1);

      expect(next.offset).toBe(current.offset + current.limit);
    }
  });
});

describe("listSidebarConversationsFn", () => {
  it("deletes conversations older than 7 days before listing the current page", async () => {
    const expiredAt = new Date(Date.now() - 8 * DAY_MS);
    const freshAt = new Date();

    const [expiredId, freshId] = await Promise.all([
      seedThread({
        resourceId: userId,
        title: "Expired",
        createdAt: expiredAt,
        updatedAt: expiredAt,
      }),
      seedThread({
        resourceId: userId,
        title: "Fresh",
        createdAt: freshAt,
        updatedAt: freshAt,
      }),
    ]);

    const result = expectOk(await listSidebarConversationsFn(sidebarCtx, { page: 0, userId }));

    expect(result.items.map((item) => item.id)).toEqual([freshId]);
    expect(result.items.map((item) => item.id)).not.toContain(expiredId);
  });

  it("keeps conversations just inside the 7-day retention window and deletes those just outside", async () => {
    const justInside = new Date(Date.now() - 7 * DAY_MS + MINUTE_MS);
    const justOutside = new Date(Date.now() - 7 * DAY_MS - MINUTE_MS);

    const [insideId, outsideId] = await Promise.all([
      seedThread({
        resourceId: userId,
        title: "Just inside",
        createdAt: justInside,
        updatedAt: justInside,
      }),
      seedThread({
        resourceId: userId,
        title: "Just outside",
        createdAt: justOutside,
        updatedAt: justOutside,
      }),
    ]);

    const result = expectOk(await listSidebarConversationsFn(sidebarCtx, { page: 0, userId }));
    const ids = result.items.map((item) => item.id);

    expect(ids).toContain(insideId);
    expect(ids).not.toContain(outsideId);
  });

  it("returns conversations newest-first", async () => {
    const older = new Date(Date.now() - 2 * HOUR_MS);
    const newer = new Date(Date.now() - 30 * MINUTE_MS);

    const [, newerId] = await Promise.all([
      seedThread({
        resourceId: userId,
        title: "Older",
        createdAt: older,
        updatedAt: older,
      }),
      seedThread({
        resourceId: userId,
        title: "Newer",
        createdAt: newer,
        updatedAt: newer,
      }),
    ]);

    const result = expectOk(await listSidebarConversationsFn(sidebarCtx, { page: 0, userId }));

    expect(result.items.at(0)?.id).toBe(newerId);
  });
});

describe("listSidebarTopicsFn", () => {
  it("reports hasMore when more topics exist beyond the page", async () => {
    await Promise.all(
      Array.from({ length: 3 }, async (_, index) =>
        seedTopic({
          userId,
          title: `Topic ${String(index)}`,
          updatedAt: new Date(Date.UTC(2026, 0, index + 1)),
        }),
      ),
    );

    const [firstPageResult, secondPageResult] = await Promise.all([
      listSidebarTopicsFn(sidebarCtx, {
        userId,
        limit: 2,
        offset: 0,
      }),
      listSidebarTopicsFn(sidebarCtx, {
        userId,
        limit: 2,
        offset: 2,
      }),
    ]);
    const firstPage = expectOk(firstPageResult);
    const secondPage = expectOk(secondPageResult);

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.hasMore).toBe(false);
  });

  it("attaches topic conversations from memory", async () => {
    const topicId = await seedTopic({ userId, title: "With threads" });
    const threadId = await seedThread({
      resourceId: topicId,
      title: "Inside topic",
    });

    const result = expectOk(
      await listSidebarTopicsFn(sidebarCtx, {
        userId,
        limit: 10,
        offset: 0,
      }),
    );

    const topicItem = result.items.find((item) => item.id === topicId);
    expect(topicItem?.threads.map((thread) => thread.id)).toEqual([threadId]);
  });
});
