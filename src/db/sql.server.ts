import { ilike as ilikeOperator, like } from "drizzle-orm";
import type { SQL, SQLWrapper } from "drizzle-orm";

/**
 * `%` and `_` are LIKE wildcards; Postgres treats `\` as the default escape character,
 * so escaping the pattern is enough — no `ESCAPE` clause needed.
 */
const escapeLikePattern = (value: string) =>
  value.replaceAll(/[\\%_]/g, (character) => `\\${character}`);

/** Case-insensitive match on rows containing `value`, taken literally; no `value`, no filter. */
export function ilike(column: SQLWrapper, value: string): SQL;
export function ilike(column: SQLWrapper, value: string | undefined): SQL | undefined;
export function ilike(column: SQLWrapper, value: string | undefined): SQL | undefined {
  if (value === undefined) {
    return;
  }

  return ilikeOperator(column, `%${escapeLikePattern(value)}%`);
}

/** Match rows whose column starts with `prefix`, taken literally. */
export const startsWith = (column: SQLWrapper, prefix: string) =>
  like(column, `${escapeLikePattern(prefix)}%`);
