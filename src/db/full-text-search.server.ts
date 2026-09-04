import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import * as v from "valibot";

/** Markers would read as syntax in a markdown snippet, so the fragments come back unmarked. */
export const HEADLINE_OPTIONS = 'MaxFragments=3, MinWords=8, MaxWords=25, StartSel="", StopSel=""';

export const languageSchema = v.picklist(["english", "other"]);

export type SearchLanguage = v.InferOutput<typeof languageSchema>;

/**
 * English is the only stemmer worth having here, so every other language searches the unstemmed
 * vector: exact word forms only, but nothing lost to English stemming or to a word that happens
 * to sit on the English stop list.
 */
export const SEARCH_CONFIG_BY_LANGUAGE = {
  english: sql`'english'`,
  other: sql`'simple'`,
} satisfies Record<SearchLanguage, SQL>;
