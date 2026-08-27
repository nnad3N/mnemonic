import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { threadRun } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { createSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { NoteToolError } from "@/mastra/tools/note-tool-helpers.server";
import { readAgentNoteFn } from "@/mastra/tools/read-note-tool.server";
import { updateAgentNoteFn } from "@/mastra/tools/update-note-tool.server";
import { createAgentNoteFn } from "@/mastra/tools/write-note-tool.server";
import {
  createNoteFn,
  saveNoteBodyFn,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";
import { clearDatabase } from "@/test/clear-database";
import { expectErr, expectOk } from "@/test/result";
import { seedThread, seedTopic, seedUser } from "@/test/seed";

const ctx = Kit.createContext(dbKit, memoryKit);

const userId = createSafeId<"user">();
const topicId = createSafeId<"topic">();

const seedRun = async (threadId: string) =>
  expectOk(
    await ctx.db.run((db) =>
      db.insert(threadRun).values({
        agentId: "conversation-agent",
        runId: createSafeId<"run">(),
        threadId,
        userId,
      }),
    ),
  );

const listVersions = async (noteId: SafeId<"note">) =>
  expectOk(
    await ctx.db.run((db) =>
      db.query.noteVersion.findMany({
        where: { noteId },
        columns: { author: true, content: true, seq: true },
        orderBy: { seq: "asc" },
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

describe("agent note versioning", () => {
  it("appends one version per run and overwrites it on later writes in the same run", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "draft",
        threadId,
        title: "Plan",
        userId,
      }),
    );

    expectOk(
      await updateAgentNoteFn(ctx, {
        newText: "first",
        oldText: "draft",
        noteId: id,
        threadId,
        userId,
      }),
    );
    expectOk(
      await updateAgentNoteFn(ctx, {
        newText: "second",
        oldText: "first",
        noteId: id,
        threadId,
        userId,
      }),
    );

    expect(await listVersions(id)).toEqual([
      { author: "user", content: "draft", seq: 1 },
      { author: "agent", content: "second", seq: 2 },
    ]);
  });

  it("appends a fresh version once a new run starts", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createAgentNoteFn(ctx, { content: "from run one", threadId, title: "Plan", userId }),
    );

    // A new run resets the bookkeeping, so the next write may not touch run one's version.
    expectOk(
      await ctx.db.run((db) =>
        db.update(threadRun).set({ runId: createSafeId<"run">(), versionedNoteIds: [] }),
      ),
    );

    expectOk(
      await updateAgentNoteFn(ctx, {
        newText: "from run two",
        oldText: "from run one",
        noteId: id,
        threadId,
        userId,
      }),
    );

    expect(await listVersions(id)).toEqual([
      { author: "agent", content: "from run one", seq: 1 },
      { author: "agent", content: "from run two", seq: 2 },
    ]);
  });

  it("keeps the agent version intact when the user saves over it", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createAgentNoteFn(ctx, { content: "agent text", threadId, title: "Plan", userId }),
    );

    expectOk(await saveNoteBodyFn(ctx, { content: "user text", noteId: id }));

    expect(await listVersions(id)).toEqual([
      { author: "agent", content: "agent text", seq: 1 },
      { author: "user", content: "user text", seq: 2 },
    ]);
  });

  it("rejects a replacement whose oldText is missing or ambiguous", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createAgentNoteFn(ctx, {
        content: "alpha beta alpha",
        threadId,
        title: "Plan",
        userId,
      }),
    );

    const missing = expectErr(
      await updateAgentNoteFn(ctx, {
        newText: "x",
        oldText: "gamma",
        noteId: id,
        threadId,
        userId,
      }),
    );
    const ambiguous = expectErr(
      await updateAgentNoteFn(ctx, {
        newText: "x",
        oldText: "alpha",
        noteId: id,
        threadId,
        userId,
      }),
    );

    expect(NoteToolError.is(missing)).toBe(true);
    expect(NoteToolError.is(ambiguous)).toBe(true);
    expect(await listVersions(id)).toHaveLength(1);
  });

  it("reads notes of sibling topic threads and hides notes outside the scope", async () => {
    const [threadId, siblingThreadId, foreignThreadId] = await Promise.all([
      seedThread({ resourceId: topicId }),
      seedThread({ resourceId: topicId }),
      seedThread({ resourceId: userId }),
    ]);
    const [sibling, foreign] = await Promise.all([
      createNoteFn(ctx, {
        author: "user",
        content: "sibling",
        threadId: siblingThreadId,
        title: "Sibling",
        userId,
      }).then(expectOk),
      createNoteFn(ctx, {
        author: "user",
        content: "foreign",
        threadId: foreignThreadId,
        title: "Foreign",
        userId,
      }).then(expectOk),
    ]);

    const read = expectOk(await readAgentNoteFn(ctx, { noteId: sibling.id, threadId, userId }));
    const denied = expectErr(await readAgentNoteFn(ctx, { noteId: foreign.id, threadId, userId }));

    expect(read).toEqual({ content: "sibling", title: "Sibling" });
    expect(NoteToolError.is(denied)).toBe(true);
  });
});
