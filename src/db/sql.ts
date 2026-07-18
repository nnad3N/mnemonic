import { like, sql } from "drizzle-orm";
import type { SQLWrapper } from "drizzle-orm";

/** Case-insensitive LIKE for SQLite/libSQL (`lower(column) LIKE lower(pattern)`). */
export const ilike = (column: SQLWrapper, pattern: string) =>
  like(sql`lower(${column})`, pattern.toLowerCase());

/** Current time as Unix epoch milliseconds — use as `.default(now)` on `timestamp_ms` columns. */
export const now = sql`(unixepoch() * 1000)`;
