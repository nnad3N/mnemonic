import { defineRelationsPart, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { user } from "@/db/auth-schema.server";
import { now } from "@/db/sql.server";
import type { ModelCapability } from "@/lib/model-capability";
import { DEFAULT_MODEL_CAPABILITY } from "@/lib/model-capability";
import type { SafeId } from "@/lib/safe-id";

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
    active: integer("active", { mode: "boolean" }).notNull().default(false),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(now),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date())
      .default(now),
  },
  (table) => [
    index("byok_userId_idx").on(table.userId),
    uniqueIndex("byok_one_active_per_user")
      .on(table.userId)
      .where(sql`${table.active} = 1`),
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

export const appRelations = defineRelationsPart(
  { file, byok, threadSettings, topic, user },
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
    topic: {
      files: r.many.file(),
      user: r.one.user({
        from: r.topic.userId,
        to: r.user.id,
      }),
    },
    user: {
      byoks: r.many.byok(),
      threadSettings: r.many.threadSettings(),
    },
    threadSettings: {
      user: r.one.user({
        from: r.threadSettings.userId,
        to: r.user.id,
      }),
    },
  }),
);
