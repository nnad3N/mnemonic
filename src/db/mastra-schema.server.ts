import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Read-only mirror of the thread table Mastra creates and migrates at runtime, introspected
 * with `drizzle-kit pull`. Mastra owns the table: this file is deliberately absent from
 * `drizzle.config.ts`, whose `tablesFilter` also excludes `mastra_*`, so drizzle-kit can
 * never generate, alter or drop it. Only the columns we query are declared.
 */
export const mastraThread = sqliteTable("mastra_threads", {
  id: text("id").primaryKey(),
});
