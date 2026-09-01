import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

import { docs, getDocsMember, searchDocs } from "@/lib/docs/docs-index";
import { docsLibraries, docsMemberSchema } from "@/lib/docs/docs-types";

const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 15;
const MAX_SUGGESTIONS = 8;

const librarySchema = v.picklist(docsLibraries);

const inputSchema = v.object({
  library: librarySchema,
  name: v.optional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description(
        "Returns this member's signatures and description. Case-insensitive, as listed when neither `name` nor `query` is given.",
      ),
    ),
  ),
  query: v.optional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description(
        "Finds members from plain language when the name is unknown. Matched against member names, signatures and descriptions.",
      ),
    ),
  ),
  limit: v.optional(
    v.pipe(
      v.number(),
      v.integer(),
      v.minValue(1),
      v.maxValue(MAX_SEARCH_LIMIT),
      v.description(`Caps \`query\` results. Defaults to ${DEFAULT_SEARCH_LIMIT}.`),
    ),
  ),
});

const listOutputSchema = v.object({
  type: v.literal("list"),
  library: v.string(),
  version: v.string(),
  importHint: v.string(),
  names: v.array(v.string()),
});

const memberOutputSchema = v.object({
  type: v.literal("member"),
  library: v.string(),
  importHint: v.string(),
  member: docsMemberSchema,
});

const searchOutputSchema = v.object({
  type: v.literal("search"),
  library: v.string(),
  importHint: v.string(),
  members: v.array(docsMemberSchema),
});

const errorOutputSchema = v.object({
  type: v.literal("error"),
  message: v.string(),
  suggestions: v.optional(v.array(v.string())),
});

const outputSchema = v.variant("type", [
  listOutputSchema,
  memberOutputSchema,
  searchOutputSchema,
  errorOutputSchema,
]);

type DocsOutput = v.InferOutput<typeof outputSchema>;

export const computeDocsTool = createTool({
  id: "compute-docs",
  inputSchema: toStandardJsonSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: [
    "Bundled API reference for mathjs and papaparse, the libraries importable inside the code sandbox.",
    "For mathjs, `expressionExamples` are written in the mathjs expression language used by `math.evaluate(...)`, not in JavaScript.",
  ].join(" "),
  // oxlint-disable-next-line typescript/require-await
  execute: async (input) => {
    const { library } = docs[input.library];

    if (input.name) {
      const member = getDocsMember(input.library, input.name);

      if (!member) {
        return {
          type: "error",
          message: `${input.library} has no member named "${input.name}".`,
          suggestions: searchDocs({
            name: input.library,
            query: input.name,
            limit: MAX_SUGGESTIONS,
          }).map((match) => match.name),
        } satisfies DocsOutput;
      }

      return {
        type: "member",
        library: library.library,
        importHint: library.importHint,
        member,
      } satisfies DocsOutput;
    }

    if (input.query) {
      const members = searchDocs({
        name: input.library,
        query: input.query,
        limit: input.limit ?? DEFAULT_SEARCH_LIMIT,
      });

      if (members.length === 0) {
        return {
          type: "error",
          message: `Nothing in ${input.library} matched "${input.query}".`,
        } satisfies DocsOutput;
      }

      return {
        type: "search",
        library: library.library,
        importHint: library.importHint,
        members,
      } satisfies DocsOutput;
    }

    return {
      type: "list",
      library: library.library,
      version: library.version,
      importHint: library.importHint,
      names: library.members.map((member) => member.name),
    } satisfies DocsOutput;
  },
});
