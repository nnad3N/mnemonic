import { defineRelationsPart } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { user } from "@/db/auth-schema";
import { now } from "@/db/sql";
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

export const appRelations = defineRelationsPart({ file, topic, user }, (r) => ({
  file: {
    topic: r.one.topic({
      from: r.file.topicId,
      to: r.topic.id,
    }),
  },
  topic: {
    files: r.many.file(),
    user: r.one.user({
      from: r.topic.userId,
      to: r.user.id,
    }),
  },
}));
