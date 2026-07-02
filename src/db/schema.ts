import { defineRelationsPart } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import { user } from "@/db/auth-schema";
import type { SafeId } from "@/lib/safe-id";

export type FileStatus = "uploading" | "processing" | "ready" | "failed";

export const topic = pgTable("topic", {
  id: varchar("id", { length: 21 })
    .$type<SafeId<"topic">>()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .$type<SafeId<"user">>()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: varchar("title", { length: 255 }).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date())
    .defaultNow(),
});

export const file = pgTable(
  "file",
  {
    id: varchar("id", { length: 21 })
      .$type<SafeId<"file">>()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .$type<SafeId<"user">>()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    topicId: varchar("topic_id", { length: 21 })
      .$type<SafeId<"topic">>()
      .notNull()
      .references(() => topic.id, { onDelete: "restrict" }),

    displayName: varchar("display_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),

    s3Key: text("s3_key").notNull(),

    status: varchar("status", { length: 32 })
      .$type<FileStatus>()
      .notNull()
      .default("uploading"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("file_topic_sha256_unique").on(table.topicId, table.sha256),
  ]
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
