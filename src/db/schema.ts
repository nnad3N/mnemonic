import { defineRelationsPart } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

import { user } from "@/db/auth-schema";

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

export const appRelations = defineRelationsPart({ topic, user }, (r) => ({
  topic: {
    user: r.one.user({
      from: r.topic.userId,
      to: r.user.id,
    }),
  },
}));
