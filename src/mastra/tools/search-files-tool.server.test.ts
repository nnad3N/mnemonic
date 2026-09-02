import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { filePage } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { getMentionKey } from "@/lib/mention-key";
import { createSafeId, rawId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { searchAgentFilesFn } from "@/mastra/tools/search-files-tool.server";
import { clearDatabase } from "@/test/clear-database";
import { expectOk } from "@/test/result";
import { seedFile, seedTopic, seedUser } from "@/test/seed";

const ctx = Kit.createContext(dbKit);

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();
const otherTopicId = createSafeId<"topic">();

const seedPages = async (fileId: SafeId<"file">, contents: string[]) =>
  expectOk(
    await ctx.db.run((db) =>
      db
        .insert(filePage)
        .values(contents.map((content, index) => ({ fileId, page: index + 1, content }))),
    ),
  );

beforeEach(async () => {
  await seedUser({ id: userId });
  await seedTopic({ userId, id: topicId });
  await seedTopic({ userId, id: otherTopicId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("searchAgentFilesFn", () => {
  it("returns hits only from the topic's ready files, located by page", async () => {
    const ready = await seedFile({ userId, topicId, status: "ready", displayName: "report.pdf" });
    const processing = await seedFile({ userId, topicId, status: "processing" });
    const elsewhere = await seedFile({ userId, topicId: otherTopicId, status: "ready" });
    await seedPages(ready.fileId, ["nothing of note here", "the kumquat harvest doubled"]);
    await seedPages(processing.fileId, ["kumquat prices"]);
    await seedPages(elsewhere.fileId, ["kumquat exports"]);

    const { matches } = expectOk(
      await searchAgentFilesFn(ctx, {
        fileId: undefined,
        language: "english",
        limit: 10,
        query: "kumquat",
        topicId,
      }),
    );

    expect(matches).toEqual([
      {
        displayName: "report.pdf",
        fileKey: getMentionKey({ type: "file", value: rawId(ready.fileId) }),
        page: 2,
        snippet: expect.stringContaining("kumquat"),
      },
    ]);
  });

  it("limits the search to the named file", async () => {
    const first = await seedFile({ userId, topicId, status: "ready" });
    const second = await seedFile({ userId, topicId, status: "ready" });
    await seedPages(first.fileId, ["kumquat harvest"]);
    await seedPages(second.fileId, ["kumquat exports"]);

    const { matches } = expectOk(
      await searchAgentFilesFn(ctx, {
        fileId: second.fileId,
        language: "english",
        limit: 10,
        query: "kumquat",
        topicId,
      }),
    );

    expect(matches.map((match) => match.fileKey)).toEqual([
      getMentionKey({ type: "file", value: rawId(second.fileId) }),
    ]);
  });
});
