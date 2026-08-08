import { describe, expect, it } from "vitest";

import type { DocsMember } from "@/lib/docs/docs-types";
import { buildSearchIndex, searchIndex } from "@/lib/docs/search";

const member = (name: string, summary: string, signatures: string[]): DocsMember => ({
  name,
  kind: "function",
  summary,
  signatures,
  description: summary,
  seealso: [],
});

const members: DocsMember[] = [
  member("std", "Compute the standard deviation of a matrix.", [
    "std(...args: MathScalarType[]): MathScalarType",
    "std(\n  array: MathCollection,\n  normalization: 'unbiased'\n): MathNumericType",
  ]),
  member("unparse", "Unparses javascript data objects and returns a csv string.", [
    "unparse<T>(data: T[], config?: UnparseConfig): string",
  ]),
  member("createUnit", "Create a user-defined unit and register it.", [
    "createUnit(name: string, definition?: string): Unit",
  ]),
];

describe("searchIndex", () => {
  const index = buildSearchIndex(members);

  it("maps a match back to the member whose chunk contains it", () => {
    expect(searchIndex(index, "standard deviation", { limit: 3 }).at(0)).toBe(0);
    expect(searchIndex(index, "csv string", { limit: 3 }).at(0)).toBe(1);
  });

  it("ranks a name hit above a description hit", () => {
    expect(searchIndex(index, "unit", { limit: 3 }).at(0)).toBe(2);
  });

  it("tolerates a misspelling", () => {
    expect(searchIndex(index, "deviaton", { limit: 3 })).toContain(0);
  });

  it("returns nothing for a query of only short tokens", () => {
    expect(searchIndex(index, "a b", { limit: 3 })).toEqual([]);
  });
});
