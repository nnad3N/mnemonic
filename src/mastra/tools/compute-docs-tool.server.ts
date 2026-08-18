import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

import { docs, getDocsMember, searchDocs } from "@/lib/docs/docs-index";
import { docsLibraries, docsMemberSchema } from "@/lib/docs/docs-types";
import { toToolInputSchema } from "@/mastra/tools/tool-input-schema.server";

const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 15;
const MAX_SUGGESTIONS = 8;

const librarySchema = v.picklist(docsLibraries);

const inputSchema = v.variant("mode", [
  v.object({
    mode: v.pipe(v.literal("list"), v.description("Return every member name in the library.")),
    library: librarySchema,
  }),
  v.object({
    mode: v.pipe(
      v.literal("function"),
      v.description("Return one member's signatures and description."),
    ),
    library: librarySchema,
    name: v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description('Member name as returned by mode "list". Case-insensitive.'),
    ),
  }),
  v.object({
    mode: v.pipe(
      v.literal("search"),
      v.description("Find members from a plain-language query when the name is unknown."),
    ),
    library: librarySchema,
    query: v.pipe(
      v.string(),
      v.nonEmpty(),
      v.description("Matched against member names, signatures and descriptions."),
    ),
    limit: v.optional(
      v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
        v.maxValue(MAX_SEARCH_LIMIT),
        v.description(`Defaults to ${DEFAULT_SEARCH_LIMIT}.`),
      ),
    ),
  }),
]);

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
  inputSchema: toToolInputSchema(inputSchema),
  outputSchema: toStandardJsonSchema(outputSchema),
  description: [
    "Bundled API reference for mathjs and papaparse, the libraries importable inside the code sandbox.",
    "For mathjs, `expressionExamples` are written in the mathjs expression language used by `math.evaluate(...)`, not in JavaScript.",
  ].join(" "),
  // oxlint-disable-next-line typescript/require-await
  execute: async (input) => {
    const { library } = docs[input.library];

    switch (input.mode) {
      case "list":
        return {
          type: "list",
          library: library.library,
          version: library.version,
          importHint: library.importHint,
          names: library.members.map((member) => member.name),
        } satisfies DocsOutput;
      case "function": {
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
      case "search": {
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
    }
  },
});
