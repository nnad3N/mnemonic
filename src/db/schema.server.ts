import { defineRelationsPart, isNotNull, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
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

    versionedNoteIds: text("versioned_note_ids", { mode: "json" })
      .$type<SafeId<"note">[]>()
      .notNull()
      .default(sql`'[]'`),

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

/** A note's current content is its highest-`seq` row in `noteVersion`. */
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
    /** A note is scoped by its topic when it has one, and by its thread otherwise. */
    topicId: text("topic_id")
      .$type<SafeId<"topic">>()
      .references(() => topic.id, { onDelete: "restrict" }),
    threadId: text("thread_id"),

    title: text("title").notNull(),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date())
      .default(now),
  },
  (table) => [
    index("note_thread_id_idx").on(table.threadId),
    index("note_topic_id_idx").on(table.topicId),
    check(
      "note_scope_not_null",
      sql`${table.threadId} is not null or ${table.topicId} is not null`,
    ),
  ],
);

/**
 * Full snapshot per save. A user save overwrites the latest version when they wrote it too, and
 * appends a new one when the agent wrote last, so an agent's text stays diffable on its own.
 */
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
    contentHash: text("content_hash").notNull(),
    author: text("author").$type<NoteVersionAuthor>().notNull(),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    // SQLite ADD COLUMN only takes constant defaults, so the runtime default carries inserts.
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .default(sql`0`),
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
