import { defineRelationsPart, isNotNull } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { user } from "@/db/auth-schema.server";
import { now } from "@/db/sql.server";
import type { ModelCapability } from "@/lib/model-capability";
import { DEFAULT_MODEL_CAPABILITY } from "@/lib/model-capability";
import type { SafeId } from "@/lib/safe-id";
import type { MnemonicAgentId } from "@/mastra/agents/id.server";
import type { WorkTiming } from "@/routes/_protected.chat.$threadId/-thread-types";

export type FileStatus = "uploading" | "processing" | "ready" | "failed";

export const topic = sqliteTable("topic", {
  id: text("id")
    .$type<SafeId<"topic">>()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .$type<SafeId<"user">>()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: text("title").notNull(),

  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date())
    .default(now),
});

export const file = sqliteTable(
  "file",
  {
    id: text("id")
      .$type<SafeId<"file">>()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .$type<SafeId<"user">>()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    topicId: text("topic_id")
      .$type<SafeId<"topic">>()
      .notNull()
      .references(() => topic.id, { onDelete: "restrict" }),

    displayName: text("display_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),

    s3Key: text("s3_key").notNull(),

    status: text("status").$type<FileStatus>().notNull().default("uploading"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date())
      .default(now),
  },
  (table) => [uniqueIndex("file_topic_sha256_unique").on(table.topicId, table.sha256)],
);

export const byok = sqliteTable(
  "byok",
  {
    id: text("id")
      .$type<SafeId<"byok">>()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .$type<SafeId<"user">>()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    name: text("name").notNull().default("OpenRouter"),

    /** Encrypted with `encryptSecret`; never returned to the client. */
    value: text("value").notNull(),
    keyPreview: text("key_preview").notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date())
      .default(now),
  },
  (table) => [
    index("byok_userId_idx").on(table.userId),
    uniqueIndex("byok_one_active_per_user").on(table.userId).where(isNotNull(table.activatedAt)),
  ],
);

export const threadSettings = sqliteTable("thread_settings", {
  threadId: text("thread_id").primaryKey(),
  userId: text("user_id")
    .$type<SafeId<"user">>()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  modelCapability: text("model_capability")
    .$type<ModelCapability>()
    .notNull()
    .default(DEFAULT_MODEL_CAPABILITY),

  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$onUpdate(() => new Date())
    .default(now),
});

export type ThreadRunStatus = "aborted" | "running" | "finished" | "errored" | "interrupted";

export const threadRun = sqliteTable(
  "thread_run",
  {
    threadId: text("thread_id").primaryKey(),
    userId: text("user_id")
      .$type<SafeId<"user">>()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    runId: text("run_id").$type<SafeId<"run">>().notNull(),
    agentId: text("agent_id").$type<MnemonicAgentId>().notNull(),

    status: text("status").$type<ThreadRunStatus>().notNull().default("running"),

    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().default(now),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("thread_run_user_id_idx").on(table.userId)],
);

/** What mnemonic records about a reply, keyed by the user message whose run produced it. */
export const threadReply = sqliteTable(
  "thread_reply",
  {
    userMessageId: text("user_message_id").primaryKey(),
    threadId: text("thread_id").notNull(),
    workTimings: text("work_timings", { mode: "json" }).$type<WorkTiming[]>().notNull(),
  },
  (table) => [index("thread_reply_thread_id_idx").on(table.threadId)],
);

export type NoteVersionAuthor = "user" | "agent";

/**
 * `mainSeq` and `draftSeq` point into `noteVersion`: everything up to `mainSeq` is published,
 * everything above it is draft. Agents commit on draft only, so a version never has to be
 * branched or merged, and only main is embedded.
 */
export const note = sqliteTable(
  "note",
  {
    id: text("id")
      .$type<SafeId<"note">>()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .$type<SafeId<"user">>()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    /** Null for a conversation note, which therefore can never be shared. */
    topicId: text("topic_id")
      .$type<SafeId<"topic">>()
      .references(() => topic.id, { onDelete: "restrict" }),
    threadId: text("thread_id").notNull(),

    title: text("title").notNull(),

    mainSeq: integer("main_seq").notNull().default(0),
    draftSeq: integer("draft_seq").notNull().default(0),

    /** Autosaved user text; not a version until committed, and agents never read it. */
    workingCopy: text("working_copy"),
    workingBaseSeq: integer("working_base_seq"),

    /** Set only by the user; a shared note is visible and embedded topic-wide. */
    sharedAt: integer("shared_at", { mode: "timestamp_ms" }),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date())
      .default(now),
  },
  (table) => [
    index("note_thread_id_idx").on(table.threadId),
    index("note_topic_id_idx").on(table.topicId),
  ],
);

/** Full snapshot per commit; diffs are computed from adjacent versions, never stored. */
export const noteVersion = sqliteTable(
  "note_version",
  {
    id: text("id")
      .$type<SafeId<"noteVersion">>()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    noteId: text("note_id")
      .$type<SafeId<"note">>()
      .notNull()
      .references(() => note.id, { onDelete: "cascade" }),

    seq: integer("seq").notNull(),
    content: text("content").notNull(),
    author: text("author").$type<NoteVersionAuthor>().notNull(),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
  },
  (table) => [uniqueIndex("note_version_note_seq_unique").on(table.noteId, table.seq)],
);

export const appRelations = defineRelationsPart(
  { file, byok, note, noteVersion, threadRun, threadSettings, topic, user },
  (r) => ({
    file: {
      topic: r.one.topic({
        from: r.file.topicId,
        to: r.topic.id,
      }),
    },
    byok: {
      user: r.one.user({
        from: r.byok.userId,
        to: r.user.id,
      }),
    },
    note: {
      topic: r.one.topic({
        from: r.note.topicId,
        to: r.topic.id,
      }),
      user: r.one.user({
        from: r.note.userId,
        to: r.user.id,
      }),
      versions: r.many.noteVersion(),
    },
    noteVersion: {
      note: r.one.note({
        from: r.noteVersion.noteId,
        to: r.note.id,
      }),
    },
    topic: {
      files: r.many.file(),
      notes: r.many.note(),
      user: r.one.user({
        from: r.topic.userId,
        to: r.user.id,
      }),
    },
    user: {
      byoks: r.many.byok(),
      notes: r.many.note(),
      threadRuns: r.many.threadRun(),
      threadSettings: r.many.threadSettings(),
    },
    threadSettings: {
      user: r.one.user({
        from: r.threadSettings.userId,
        to: r.user.id,
      }),
    },
    threadRun: {
      user: r.one.user({
        from: r.threadRun.userId,
        to: r.user.id,
      }),
    },
  }),
);
