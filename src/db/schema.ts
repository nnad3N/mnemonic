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

export type ArtifactStatus = "uploading" | "processing" | "ready" | "failed";

export const topic = pgTable("topic", {
  id: varchar("id", { length: 21 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: varchar("title", { length: 255 }).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .$onUpdate(() => new Date())
    .defaultNow(),
});

export const artifact = pgTable(
  "artifact",
  {
    id: varchar("id", { length: 21 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    topicId: varchar("topic_id", { length: 21 })
      .notNull()
      .references(() => topic.id, { onDelete: "restrict" }),

    displayName: varchar("display_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),

    s3Bucket: varchar("s3_bucket", { length: 255 }).notNull(),
    s3Key: text("s3_key").notNull(),

    status: varchar("status", { length: 32 })
      .$type<ArtifactStatus>()
      .notNull()
      .default("uploading"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date())
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("artifact_topic_sha256_unique").on(table.topicId, table.sha256),
  ]
);

export const appRelations = defineRelationsPart(
  { artifact, topic, user },
  (r) => ({
    artifact: {
      topic: r.one.topic({
        from: r.artifact.topicId,
        to: r.topic.id,
      }),
    },
    topic: {
      artifacts: r.many.artifact(),
      user: r.one.user({
        from: r.topic.userId,
        to: r.user.id,
      }),
    },
  })
);
