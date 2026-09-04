import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { noteVersion } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import { hashText } from "@/lib/hash";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { createSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { clearDatabase } from "@/test/clear-database";
import { expectErr, expectOk } from "@/test/result";
import { seedThread, seedUser } from "@/test/seed";

import {
  createNoteFn,
  getNoteFn,
  saveAgentVersionFn,
  saveNoteBodyFn,
  StaleNoteVersionError,
} from "./notes.server";

const ctx = Kit.createContext(dbKit, memoryKit);

const userId = createSafeId<"user">();

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

const appendAgentVersion = async (noteId: SafeId<"note">, content: string) => {
  const versions = await listVersions(noteId);

  expectOk(
    await ctx.db.run(async (db) =>
      db.insert(noteVersion).values({
        author: "agent",
        content,
        contentHash: await hashText(content),
        id: createSafeId<"noteVersion">(),
        noteId,
        seq: (versions.at(-1)?.seq ?? 0) + 1,
      }),
    ),
  );
};

beforeEach(async () => {
  await seedUser({ id: userId });
});

afterEach(async () => {
  await clearDatabase();
});

describe("note body saves", () => {
  it("appends a new user version when the editor sits on the agent's latest", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "agent",
        content: "agent text",
        threadId,
        title: "Plan",
        userId,
      }),
    );

    const saved = expectOk(
      await saveNoteBodyFn(ctx, { content: "user text", intent: "append", noteId: id }),
    );

    expect(saved.isLatest).toBe(true);
    expect(await listVersions(id)).toEqual([
      { author: "agent", content: "agent text", seq: 1 },
      { author: "user", content: "user text", seq: 2 },
    ]);
  });

  it("lands a stale user save in its base version below the agent's latest", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "draft",
        threadId,
        title: "Plan",
        userId,
      }),
    );
    const { versionId: baseVersionId } = expectOk(await getNoteFn(ctx, { noteId: id, userId }));
    await appendAgentVersion(id, "agent text");

    const saved = expectOk(
      await saveNoteBodyFn(ctx, {
        baseVersionId,
        content: "late user text",
        intent: "overwrite",
        noteId: id,
      }),
    );

    expect(saved.isLatest).toBe(false);
    expect(await listVersions(id)).toEqual([
      { author: "user", content: "late user text", seq: 1 },
      { author: "agent", content: "agent text", seq: 2 },
    ]);
  });

  it("rejects a save whose base is not the latest user version", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "draft",
        threadId,
        title: "Plan",
        userId,
      }),
    );

    const denied = expectErr(
      await saveNoteBodyFn(ctx, {
        baseVersionId: createSafeId<"noteVersion">(),
        content: "user edits",
        intent: "overwrite",
        noteId: id,
      }),
    );

    expect(StaleNoteVersionError.is(denied)).toBe(true);
    expect(await listVersions(id)).toEqual([{ author: "user", content: "draft", seq: 1 }]);
  });

  it("rejects a baseless save when the latest version is already the user's", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "draft",
        threadId,
        title: "Plan",
        userId,
      }),
    );

    const denied = expectErr(
      await saveNoteBodyFn(ctx, { content: "user edits", intent: "append", noteId: id }),
    );

    expect(StaleNoteVersionError.is(denied)).toBe(true);
    expect(await listVersions(id)).toEqual([{ author: "user", content: "draft", seq: 1 }]);
  });
});

describe("agent version review", () => {
  it("derives a pending review until the agent's latest version is committed", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "draft",
        threadId,
        title: "Plan",
        userId,
      }),
    );
    const { versionId: userVersionId } = expectOk(await getNoteFn(ctx, { noteId: id, userId }));
    await appendAgentVersion(id, "agent text");

    const pending = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    expect(pending.pendingReviewBaseVersionId).toBe(userVersionId);

    expectOk(
      await saveAgentVersionFn(ctx, {
        commit: true,
        content: pending.content,
        noteId: id,
        versionId: pending.versionId,
        versionUpdatedAt: pending.versionUpdatedAt.getTime(),
      }),
    );

    const committed = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    expect(committed.pendingReviewBaseVersionId).toBeNull();
  });

  it("derives no pending review when there is no non-empty user version", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "agent",
        content: "agent text",
        threadId,
        title: "Plan",
        userId,
      }),
    );

    const note = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    expect(note.pendingReviewBaseVersionId).toBeNull();
  });

  it("writes reviewed text into the agent's latest version without a new entry", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "agent",
        content: "agent text",
        threadId,
        title: "Plan",
        userId,
      }),
    );
    const { versionId, versionUpdatedAt } = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    expectOk(
      await saveAgentVersionFn(ctx, {
        commit: false,
        content: "reviewed text",
        noteId: id,
        versionId,
        versionUpdatedAt: versionUpdatedAt.getTime(),
      }),
    );

    expect(await listVersions(id)).toEqual([{ author: "agent", content: "reviewed text", seq: 1 }]);
  });

  it("refuses a reviewed write whose stamp is older than the version's", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "agent",
        content: "agent text",
        threadId,
        title: "Plan",
        userId,
      }),
    );
    const { versionId, versionUpdatedAt } = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    // The agent overwrote its version in place after the review snapshot was taken.
    expectOk(
      await ctx.db.run((db) =>
        db
          .update(noteVersion)
          .set({ content: "agent newer", updatedAt: new Date(versionUpdatedAt.getTime() + 5) })
          .where(eq(noteVersion.id, versionId)),
      ),
    );

    const denied = expectErr(
      await saveAgentVersionFn(ctx, {
        commit: false,
        content: "reviewed text",
        noteId: id,
        versionId,
        versionUpdatedAt: versionUpdatedAt.getTime(),
      }),
    );

    expect(StaleNoteVersionError.is(denied)).toBe(true);
    expect(await listVersions(id)).toEqual([{ author: "agent", content: "agent newer", seq: 1 }]);
  });

  it("refuses a reviewed write when the target is not the agent's latest version", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "draft",
        threadId,
        title: "Plan",
        userId,
      }),
    );
    const { versionId, versionUpdatedAt } = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    const denied = expectErr(
      await saveAgentVersionFn(ctx, {
        commit: false,
        content: "reviewed text",
        noteId: id,
        versionId,
        versionUpdatedAt: versionUpdatedAt.getTime(),
      }),
    );

    expect(StaleNoteVersionError.is(denied)).toBe(true);
    expect(await listVersions(id)).toEqual([{ author: "user", content: "draft", seq: 1 }]);
  });
});
