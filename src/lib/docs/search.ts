import { FuzzySearch } from "@stll/fuzzy-search";

import type { DocsMember } from "@/lib/docs/docs-types";

const MAX_TOKEN_DISTANCE = 2;
const CHARACTERS_PER_EDIT = 4;

type Chunk = {
  text: string;
  /** End of the member name, which the chunk opens with. Matches before it are name hits. */
  nameEnd: number;
  /** End of name plus summary. Matches before it describe the member rather than mention it. */
  headEnd: number;
};

export type SearchIndex = Chunk[];

const toChunk = (member: DocsMember): Chunk => {
  const head = [member.name, member.summary].filter((part) => part.length > 0).join("\n");
  const text = [head, ...member.signatures, member.description]
    .filter((part) => part.length > 0)
    .join("\n");

  return { text, nameEnd: member.name.length, headEnd: head.length };
};

export const buildSearchIndex = (members: DocsMember[]): SearchIndex => members.map(toChunk);

const toTokens = (query: string): string[] => [
  ...new Set(query.split(/[^\p{L}\p{N}_$]+/u).filter((token) => token.length > 1)),
];

type ChunkScore = {
  index: number;
  tokens: Set<number>;
  headTokens: Set<number>;
  nameTokens: Set<number>;
  score: number;
};

export type SearchOptions = {
  limit: number;
  minScore?: number;
};

const compareChunks = (left: ChunkScore, right: ChunkScore): number => {
  if (left.nameTokens.size !== right.nameTokens.size) {
    return right.nameTokens.size - left.nameTokens.size;
  }

  if (left.headTokens.size !== right.headTokens.size) {
    return right.headTokens.size - left.headTokens.size;
  }

  if (left.tokens.size !== right.tokens.size) {
    return right.tokens.size - left.tokens.size;
  }

  return right.score - left.score;
};

/**
 * Ranks members by where the query hits them: the member's own name first, then its name and
 * summary, then anywhere in the chunk, then the best per-token score. Position matters because a
 * long member like papaparse's `ParseConfig` otherwise collects more scattered token hits than the
 * member the query is actually describing. Returns member indices, best first.
 */
export const searchIndex = (
  index: SearchIndex,
  query: string,
  { limit, minScore = 0.6 }: SearchOptions,
): number[] => {
  const tokens = toTokens(query);

  if (tokens.length === 0 || query.length > 64) {
    return [];
  }

  const search = new FuzzySearch(
    tokens.map((token) => ({
      pattern: token,
      distance: Math.min(MAX_TOKEN_DISTANCE, Math.floor(token.length / CHARACTERS_PER_EDIT)),
    })),
    { caseInsensitive: true, minScore, wholeWords: false },
  );

  const scores: ChunkScore[] = [];

  for (const [position, chunk] of index.entries()) {
    const entry: ChunkScore = {
      index: position,
      tokens: new Set(),
      headTokens: new Set(),
      nameTokens: new Set(),
      score: 0,
    };

    for (const match of search.findIter(chunk.text)) {
      entry.tokens.add(match.pattern);

      if (match.start < chunk.headEnd) {
        entry.headTokens.add(match.pattern);
      }

      // Only an exact occurrence earns the name weight. An approximate one is too easy to come by
      // in a short identifier — "deviation" is two edits from "Radiation".
      if (match.start < chunk.nameEnd && match.distance === 0) {
        entry.nameTokens.add(match.pattern);
      }

      entry.score = Math.max(entry.score, match.score);
    }

    if (entry.tokens.size > 0) {
      scores.push(entry);
    }
  }

  return scores
    .sort(compareChunks)
    .slice(0, limit)
    .map((entry) => entry.index);
};
