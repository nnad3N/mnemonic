import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dbKit } from "@/lib/db-kit";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit";
import { createSafeId } from "@/lib/safe-id";
import { expectOk } from "@/test/result";
import { clearDatabase, seedThread, seedUser } from "@/test/seed";

import { listSidebarConversationsFn } from "./sidebar-data";

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

describe("listSidebarConversationsFn", () => {
  it("deletes conversations older than 7 days before listing", async () => {
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

    const conversations = expectOk(await listSidebarConversationsFn(sidebarCtx, { userId }));

    expect(conversations.map((item) => item.id)).toEqual([freshId]);
    expect(conversations.map((item) => item.id)).not.toContain(expiredId);
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

    const conversations = expectOk(await listSidebarConversationsFn(sidebarCtx, { userId }));
    const ids = conversations.map((item) => item.id);

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

    const conversations = expectOk(await listSidebarConversationsFn(sidebarCtx, { userId }));

    expect(conversations.at(0)?.id).toBe(newerId);
  });
});
