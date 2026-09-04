import { defineRelationsPart, isNotNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import { user } from "@/db/auth-schema.server";
import type { ModelOption } from "@/lib/model-option";
import { DEFAULT_MODEL_OPTION } from "@/lib/model-option";
import type { SafeId } from "@/lib/safe-id";
import type { MnemonicAgentId } from "@/mastra/agents/id.server";
import type { WorkTiming } from "@/routes/_protected.chat.$threadId/-thread-types";

export type FileStatus = "uploading" | "processing" | "ready" | "failed";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const topic = pgTable("topic", {
  id: text("id")
    .$type<SafeId<"topic">>()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .$type<SafeId<"user">>()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: text("title").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .$onUpdate(() => new Date())
    .defaultNow(),
});

export const file = pgTable(
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
    description: text("description"),

    s3Key: text("s3_key").notNull(),

    status: text("status").$type<FileStatus>().notNull().default("uploading"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => [uniqueIndex("file_topic_sha256_unique").on(table.topicId, table.sha256)],
);

export const fileContent = pgTable(
  "file_content",
  {
    fileId: text("file_id")
      .$type<SafeId<"file">>()
      .notNull()
      .references(() => file.id, { onDelete: "cascade" }),
    /** 1-based position among the file's contents. */
    seq: integer("seq").notNull(),
    /** Position in the file, 1-based, not the number printed on the page. Null when the format has no pages. */
    page: integer("page"),
    content: text("content").notNull(),
    searchVectorEnglish: tsvector("search_vector_english").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${fileContent.content})`,
    ),
    searchVectorSimple: tsvector("search_vector_simple").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', ${fileContent.content})`,
    ),
  },
  (table) => [
    primaryKey({ columns: [table.fileId, table.seq] }),
    index("file_content_search_english_idx").using("gin", table.searchVectorEnglish),
    index("file_content_search_simple_idx").using("gin", table.searchVectorSimple),
  ],
);

export type Provider = "openrouter";

export const byok = pgTable(
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

    name: text("name").notNull(),
    provider: text("provider").$type<Provider>().notNull().default("openrouter"),

    value: text("value").notNull(),
    keyPreview: text("key_preview").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => [
    index("byok_userId_idx").on(table.userId),
    uniqueIndex("byok_one_active_per_user").on(table.userId).where(isNotNull(table.activatedAt)),
  ],
);

export const threadSettings = pgTable("thread_settings", {
  threadId: text("thread_id").primaryKey(),
  userId: text("user_id")
    .$type<SafeId<"user">>()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  modelOption: text("model_option").$type<ModelOption>().notNull().default(DEFAULT_MODEL_OPTION),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .$onUpdate(() => new Date())
    .defaultNow(),
});

export type ThreadRunStatus = "aborted" | "running" | "finished" | "errored" | "interrupted";

export const threadRun = pgTable(
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

    versionedNoteIds: jsonb("versioned_note_ids").$type<SafeId<"note">[]>().notNull().default([]),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("thread_run_user_id_idx").on(table.userId)],
);

export const threadReply = pgTable(
  "thread_reply",
  {
    userMessageId: text("user_message_id").primaryKey(),
    threadId: text("thread_id").notNull(),
    workTimings: jsonb("work_timings").$type<WorkTiming[]>().notNull(),
  },
  (table) => [index("thread_reply_thread_id_idx").on(table.threadId)],
);

export type NoteVersionAuthor = "user" | "agent";

export const note = pgTable(
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
    topicId: text("topic_id")
      .$type<SafeId<"topic">>()
      .references(() => topic.id, { onDelete: "restrict" }),
    threadId: text("thread_id"),

    title: text("title").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date())
      .defaultNow(),
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

export const noteVersion = pgTable(
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
    // Every version carries both although search only ever reads the latest; a stored generated
    // column costs no upkeep on the write paths, and each of them writes a version.
    searchVectorEnglish: tsvector("search_vector_english").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${noteVersion.content})`,
    ),
    searchVectorSimple: tsvector("search_vector_simple").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', ${noteVersion.content})`,
    ),
    author: text("author").$type<NoteVersionAuthor>().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("note_version_note_seq_unique").on(table.noteId, table.seq),
    index("note_version_search_english_idx").using("gin", table.searchVectorEnglish),
    index("note_version_search_simple_idx").using("gin", table.searchVectorSimple),
  ],
);

export const appRelations = defineRelationsPart(
  { file, fileContent, byok, note, noteVersion, threadRun, threadSettings, topic, user },
  (r) => ({
    file: {
      contents: r.many.fileContent(),
      topic: r.one.topic({
        from: r.file.topicId,
        to: r.topic.id,
      }),
    },
    fileContent: {
      file: r.one.file({
        from: r.fileContent.fileId,
        to: r.file.id,
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
