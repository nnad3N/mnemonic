import { sql } from "drizzle-orm";
import type { SQLWrapper } from "drizzle-orm";

/**
 * `%` and `_` are LIKE wildcards, and SQLite applies no escape character unless the query
 * names one, so every pattern built here pairs this with an explicit `ESCAPE` clause.
 */
const escapeLikePattern = (value: string) =>
  value.replaceAll(/[\\%_]/g, (character) => `\\${character}`);

/** Case-insensitive match on rows containing `value`, taken literally. */
export const ilike = (column: SQLWrapper, value: string) =>
  sql`lower(${column}) LIKE ${`%${escapeLikePattern(value.toLowerCase())}%`} ESCAPE '\\'`;

/** Match rows whose column starts with `prefix`, taken literally. */
export const startsWith = (column: SQLWrapper, prefix: string) =>
  sql`${column} LIKE ${`${escapeLikePattern(prefix)}%`} ESCAPE '\\'`;

/** Current time as Unix epoch milliseconds — use as `.default(now)` on `timestamp_ms` columns. */
export const now = sql`(unixepoch() * 1000)`;
