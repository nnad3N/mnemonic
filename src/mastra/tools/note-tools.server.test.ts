import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { noteVersion, threadRun } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import * as Kit from "@/lib/kit";
import { memoryKit } from "@/lib/memory-kit.server";
import { createSafeId } from "@/lib/safe-id";
import type { SafeId } from "@/lib/safe-id";
import { NoteToolError } from "@/mastra/tools/note-tool-helpers.server";
import { readAgentNoteFn } from "@/mastra/tools/read-note-tool.server";
import { searchAgentNotesFn } from "@/mastra/tools/search-notes-tool.server";
import type { SearchLanguage } from "@/mastra/tools/search-notes-tool.server";
import { replaceNoteText, updateAgentNoteFn } from "@/mastra/tools/update-note-tool.server";
import { createAgentNoteFn } from "@/mastra/tools/write-note-tool.server";
import {
  addNoteToTopicFn,
  createNoteFn,
  getNoteFn,
  saveAgentVersionFn,
  saveNoteBodyFn,
  StaleNoteVersionError,
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
        mode: "replace",
        newText: "first",
        oldText: "draft",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );
    expectOk(
      await updateAgentNoteFn(ctx, {
        mode: "replace",
        newText: "second",
        oldText: "first",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );

    expect(await listVersions(id)).toEqual([
      { author: "user", content: "draft", seq: 1 },
      { author: "agent", content: "second", seq: 2 },
    ]);
  });

  it("overwrites the whole content of a note the user created empty", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createNoteFn(ctx, { author: "user", content: "", threadId, title: "Plan", userId }),
    );

    expectOk(
      await updateAgentNoteFn(ctx, {
        mode: "overwrite",
        newText: "# Plan\n\nFirst draft.",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );

    expect(await listVersions(id)).toEqual([
      { author: "user", content: "", seq: 1 },
      { author: "agent", content: "# Plan\n\nFirst draft.", seq: 2 },
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
        mode: "replace",
        newText: "from run two",
        oldText: "from run one",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );

    expect(await listVersions(id)).toEqual([
      { author: "agent", content: "from run one", seq: 1 },
      { author: "agent", content: "from run two", seq: 2 },
    ]);
  });

  it("appends a new user version when the editor sits on the agent's latest", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createAgentNoteFn(ctx, { content: "agent text", threadId, title: "Plan", userId }),
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
    const { versionId: baseVersionId } = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    expectOk(
      await updateAgentNoteFn(ctx, {
        mode: "replace",
        newText: "agent text",
        oldText: "draft",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );

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

    const denied = expectErr(
      await saveNoteBodyFn(ctx, { content: "user edits", intent: "append", noteId: id }),
    );

    expect(StaleNoteVersionError.is(denied)).toBe(true);
    expect(await listVersions(id)).toEqual([{ author: "user", content: "draft", seq: 1 }]);
  });

  it("derives a pending review until the agent's latest version is committed", async () => {
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
    const { versionId: userVersionId } = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    expectOk(
      await updateAgentNoteFn(ctx, {
        mode: "replace",
        newText: "agent text",
        oldText: "draft",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );

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
    await seedRun(threadId);
    const { id } = expectOk(
      await createAgentNoteFn(ctx, { content: "agent text", threadId, title: "Plan", userId }),
    );

    const note = expectOk(await getNoteFn(ctx, { noteId: id, userId }));

    expect(note.pendingReviewBaseVersionId).toBeNull();
  });

  it("writes reviewed text into the agent's latest version without a new entry", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createAgentNoteFn(ctx, { content: "agent text", threadId, title: "Plan", userId }),
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
    await seedRun(threadId);
    const { id } = expectOk(
      await createAgentNoteFn(ctx, { content: "agent text", threadId, title: "Plan", userId }),
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
        mode: "replace",
        newText: "x",
        oldText: "gamma",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );
    const ambiguous = expectErr(
      await updateAgentNoteFn(ctx, {
        mode: "replace",
        newText: "x",
        oldText: "alpha",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );

    expect(NoteToolError.is(missing)).toBe(true);
    expect(NoteToolError.is(ambiguous)).toBe(true);
    expect(await listVersions(id)).toHaveLength(1);
  });

  it("falls back to fuzzy matching when oldText drifts on Unicode punctuation", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createAgentNoteFn(ctx, {
        content: "intro\nplan — “draft” stage\noutro",
        threadId,
        title: "Plan",
        userId,
      }),
    );

    expectOk(
      await updateAgentNoteFn(ctx, {
        mode: "replace",
        newText: 'plan - "final" stage',
        oldText: 'plan - "draft" stage',
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );

    const versions = await listVersions(id);
    expect(versions.at(-1)?.content).toBe('intro\nplan - "final" stage\noutro');
  });

  describe("replaceNoteText fuzzy fallback", () => {
    it("keeps the exact bytes of every line outside the matched span", () => {
      const result = replaceNoteText(
        "keep  these  spaces  \nfoo’s bar\nalso — untouched",
        "foo's bar",
        "swapped",
      );

      expect(result).toEqual({
        type: "replaced",
        content: "keep  these  spaces  \nswapped\nalso — untouched",
      });
    });

    it("matches across stripped trailing whitespace on multi-line spans", () => {
      const result = replaceNoteText("alpha  \nbeta\ngamma", "alpha\nbeta", "one\ntwo");

      expect(result).toEqual({ type: "replaced", content: "one\ntwo\ngamma" });
    });

    it("prefers the exact occurrence over a fuzzy one", () => {
      const result = replaceNoteText("a – b\na - b", "a - b", "x");

      expect(result).toEqual({ type: "replaced", content: "a – b\nx" });
    });

    it("reports ambiguity when only fuzzy matches exist and there are several", () => {
      const result = replaceNoteText("a – b\na — b", "a - b", "x");

      expect(result).toEqual({ type: "ambiguous", occurrences: 2 });
    });
  });

  it("reads the topic's shared notes and hides a sibling thread's own notes", async () => {
    const [threadId, siblingThreadId] = await Promise.all([
      seedThread({ resourceId: topicId }),
      seedThread({ resourceId: topicId }),
    ]);
    const [shared, sibling] = await Promise.all([
      createNoteFn(ctx, {
        author: "user",
        content: "shared",
        threadId,
        title: "Shared",
        userId,
      }).then(expectOk),
      createNoteFn(ctx, {
        author: "user",
        content: "sibling",
        threadId: siblingThreadId,
        title: "Sibling",
        userId,
      }).then(expectOk),
    ]);
    expectOk(await addNoteToTopicFn(ctx, { noteId: shared.id, userId }));

    const read = expectOk(
      await readAgentNoteFn(ctx, { noteId: shared.id, threadId, topicId, userId }),
    );
    const denied = expectErr(
      await readAgentNoteFn(ctx, { noteId: sibling.id, threadId, topicId, userId }),
    );

    expect(read).toEqual({ content: "shared", title: "Shared" });
    expect(NoteToolError.is(denied)).toBe(true);
  });
});

describe("agent note search", () => {
  const search = async (
    input: { threadId: string; language?: SearchLanguage; topicId?: SafeId<"topic"> },
    query: string,
  ) =>
    expectOk(
      await searchAgentNotesFn(ctx, {
        language: "english",
        limit: 10,
        query,
        topicId: undefined,
        userId,
        ...input,
      }),
    );

  it("searches the latest version's text, not the ones it replaced", async () => {
    const threadId = await seedThread({ resourceId: userId });
    await seedRun(threadId);
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "the quarterly figures came from kumquat",
        threadId,
        title: "Plan",
        userId,
      }),
    );

    expectOk(
      await updateAgentNoteFn(ctx, {
        mode: "replace",
        newText: "pomelo",
        oldText: "kumquat",
        noteId: id,
        threadId,
        topicId: undefined,
        userId,
      }),
    );

    const replaced = await search({ threadId }, "kumquat");
    const current = await search({ threadId }, "pomelo");

    expect(replaced.matches).toEqual([]);
    expect(current.matches.map((match) => match.noteKey)).toEqual([`note::${id}`]);
  });

  it("covers this thread's notes and the topic's, but not another thread's", async () => {
    const [threadId, siblingThreadId] = await Promise.all([
      seedThread({ resourceId: topicId }),
      seedThread({ resourceId: topicId }),
    ]);
    const seedNote = async (input: { content: string; threadId: string; title: string }) =>
      expectOk(await createNoteFn(ctx, { author: "user", userId, ...input }));

    const [own, , moved] = await Promise.all([
      seedNote({ content: "kumquat harvest", threadId, title: "Own" }),
      seedNote({ content: "kumquat prices", threadId: siblingThreadId, title: "Sibling" }),
      seedNote({ content: "kumquat exports", threadId, title: "Moved" }),
    ]);
    expectOk(await addNoteToTopicFn(ctx, { noteId: moved.id, userId }));

    const { matches } = await search({ threadId, topicId }, "kumquat");

    expect(matches.map((match) => match.noteKey).toSorted()).toEqual(
      [`note::${own.id}`, `note::${moved.id}`].toSorted(),
    );
  });

  it("finds words in another language that the English configuration would drop", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "notatka o tym do czego on doszedł",
        threadId,
        title: "Rozmowa",
        userId,
      }),
    );

    const english = await search({ threadId }, "do");
    const other = await search({ threadId, language: "other" }, "do");

    expect(english.matches).toEqual([]);
    expect(other.matches.map((match) => match.noteKey)).toEqual([`note::${id}`]);
  });

  it("finds a note by its title alone", async () => {
    const threadId = await seedThread({ resourceId: userId });
    const { id } = expectOk(
      await createNoteFn(ctx, {
        author: "user",
        content: "nothing to see",
        threadId,
        title: "Kumquat harvest",
        userId,
      }),
    );

    const { matches } = await search({ threadId }, "kumquat");

    expect(matches.map((match) => match.noteKey)).toEqual([`note::${id}`]);
  });
});
