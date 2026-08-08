import * as v from "valibot";

import type { DocsLibraryName, DocsMember } from "@/lib/docs/docs-types";
import { docsLibrarySchema } from "@/lib/docs/docs-types";
import mathjsGenerated from "@/lib/docs/generated/mathjs.json" with { type: "json" };
import papaparseGenerated from "@/lib/docs/generated/papaparse.json" with { type: "json" };
import { buildSearchIndex, searchIndex } from "@/lib/docs/search";

const load = (generated: unknown) => {
  const library = v.parse(docsLibrarySchema, generated);

  return { library, index: buildSearchIndex(library.members) };
};

export const docs = {
  mathjs: load(mathjsGenerated),
  papaparse: load(papaparseGenerated),
} as const;

export const getDocsMember = (name: DocsLibraryName, member: string): DocsMember | undefined =>
  docs[name].library.members.find(
    (candidate) => candidate.name.toLowerCase() === member.toLowerCase(),
  );

type SearchDocsInput = {
  name: DocsLibraryName;
  query: string;
  limit: number;
};

export const searchDocs = ({ name, query, limit }: SearchDocsInput): DocsMember[] => {
  const { library, index } = docs[name];

  return searchIndex(index, query, { limit })
    .map((position) => library.members.at(position))
    .filter((member) => member !== undefined);
};
