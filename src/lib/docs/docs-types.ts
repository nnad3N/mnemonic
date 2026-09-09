import * as v from "valibot";

export const docsLibraries = ["mathjs", "papaparse", "minisearch"] as const;

export const docsMemberKinds = ["function", "constant", "interface"] as const;

export const docsMemberSchema = v.object({
  name: v.string(),
  kind: v.picklist(docsMemberKinds),
  summary: v.string(),
  signatures: v.array(v.string()),
  description: v.string(),
  category: v.optional(v.string()),
  expressionExamples: v.optional(v.array(v.string())),
  seealso: v.array(v.string()),
});

export const docsLibrarySchema = v.object({
  library: v.picklist(docsLibraries),
  version: v.string(),
  importHint: v.string(),
  members: v.array(docsMemberSchema),
});

export type DocsLibraryName = (typeof docsLibraries)[number];
export type DocsMemberKind = (typeof docsMemberKinds)[number];
export type DocsMember = v.InferOutput<typeof docsMemberSchema>;
export type DocsLibrary = v.InferOutput<typeof docsLibrarySchema>;
