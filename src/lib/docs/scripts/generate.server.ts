import { readFile, writeFile } from "node:fs/promises";

import { Result } from "better-result";
import * as mathjs from "mathjs";
import { all, create } from "mathjs";
import type { JSDocableNode, SourceFile } from "ts-morph";
import { Node, Project, SyntaxKind } from "ts-morph";

import type { DocsLibrary, DocsMember, DocsMemberKind } from "@/lib/docs/docs-types";

const GENERATED_DIR = "./src/lib/docs/generated";

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  compilerOptions: { skipLibCheck: true },
});

const readVersion = async (path: string): Promise<string> => {
  const manifest: unknown = JSON.parse(await readFile(path, "utf8"));

  if (typeof manifest === "object" && manifest !== null && "version" in manifest) {
    return String(manifest.version);
  }

  throw new Error(`No version field in ${path}`);
};

/** Upstream `.d.ts` files hard-wrap their doc comments; the model wants flowing prose. */
const unwrap = (text: string): string => text.replace(/\s*\n\s*/g, " ").trim();

type Documentation = {
  description: string;
  summary: string;
};

const readDocs = (node: JSDocableNode): Documentation => {
  const doc = node.getJsDocs().at(-1);

  if (!doc) {
    return { description: "", summary: "" };
  }

  const prose = unwrap(doc.getCommentText() ?? "");
  const tags = doc.getTags().map((tag) => {
    const name =
      Node.isJSDocParameterTag(tag) || Node.isJSDocPropertyTag(tag) ? ` ${tag.getName()}` : "";

    return `@${tag.getTagName()}${name} ${unwrap(tag.getCommentText() ?? "")}`.trimEnd();
  });

  return {
    description: [prose, ...tags].filter((part) => part.length > 0).join("\n"),
    summary: /^.*?[.!?](?=\s|$)/.exec(prose)?.[0] ?? prose,
  };
};

type RawMember = {
  name: string;
  kind: DocsMemberKind;
  signature: string;
  documentation: Documentation;
};

const toRawMember = (
  name: string | undefined,
  kind: DocsMemberKind,
  node: JSDocableNode & Node,
): RawMember => ({
  name: name ?? "",
  kind,
  signature: node.getText(),
  documentation: readDocs(node),
});

/** The prose above the first tag, used to tell overload docs apart. Empty when tags-only. */
const proseOf = (description: string): string => {
  const first = description.split("\n").at(0) ?? "";

  return first.startsWith("@") ? "" : first;
};

type MemberDraft = {
  name: string;
  kind: DocsMemberKind;
  summary: string;
  signatures: string[];
  /** Overload descriptions keyed by their prose, keeping the longest copy per paragraph. */
  descriptionsByProse: Map<string, string>;
};

/**
 * Groups overloads into one member. Overloads repeating the same prose (mathjs writes the same
 * paragraph above all four `std` signatures) collapse to the longest copy, while overloads that
 * document genuinely different behaviour keep every description.
 */
const groupOverloads = (raw: RawMember[]): DocsMember[] => {
  const drafts = new Map<string, MemberDraft>();

  for (const entry of raw) {
    const { description, summary } = entry.documentation;
    const draft = drafts.get(entry.name) ?? {
      name: entry.name,
      kind: entry.kind,
      summary: "",
      signatures: [],
      descriptionsByProse: new Map<string, string>(),
    };

    draft.signatures.push(entry.signature);

    if (draft.summary.length === 0) {
      draft.summary = summary;
    }

    const prose = proseOf(description);
    const kept = draft.descriptionsByProse.get(prose);

    if (kept === undefined || description.length > kept.length) {
      draft.descriptionsByProse.set(prose, description);
    }

    drafts.set(entry.name, draft);
  }

  return [...drafts.values()].map(({ descriptionsByProse, ...member }) => {
    // An overload documented only with `@param`/`@returns` adds nothing once a sibling overload
    // carries the shared prose, so keep it only when it is all there is.
    const described = [...descriptionsByProse.entries()].filter(([prose]) => prose.length > 0);
    const kept = described.length > 0 ? described : [...descriptionsByProse.entries()];

    return {
      ...member,
      description: kept
        .map(([, text]) => text)
        .filter((text) => text.length > 0)
        .join("\n\n"),
      seealso: [],
    };
  });
};

type EmbeddedDoc = {
  category?: string;
  description?: string;
  examples?: string[];
  seealso?: string[];
  syntax?: string[];
};

/**
 * mathjs types declare `help(search: () => any)`, but the implementation looks up by name — that is
 * how `math.help("std")` works in its own docs and REPL. `toJSON()` is likewise untyped.
 */
type HelpByName = (search: string) => { toJSON: () => EmbeddedDoc };

const toMathjsMembers = (file: SourceFile): DocsMember[] => {
  const instance = file.getInterfaceOrThrow("MathJsInstance");

  const raw = [
    ...instance.getMethods().map((method) => toRawMember(method.getName(), "function", method)),
    ...instance
      .getProperties()
      .map((property) => toRawMember(property.getName(), "constant", property)),
  ];

  const members = groupOverloads(raw);
  const math = create(all, {});
  const help = (name: string): EmbeddedDoc =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- upstream signature is wrong, see HelpByName.
    (math.help as unknown as HelpByName)(name).toJSON();
  const byName = new Map(members.map((member) => [member.name, member]));

  for (const name of Object.keys(math)) {
    const embedded = Result.try(() => help(name));

    if (Result.isError(embedded)) {
      continue;
    }

    const doc = embedded.value;
    const member = byName.get(name);

    if (member) {
      member.category = doc.category;
      member.seealso = doc.seealso ?? [];
      member.expressionExamples = doc.examples ?? [];

      if (member.description.length === 0) {
        member.description = doc.description ?? "";
        member.summary = doc.description ?? "";
      }

      continue;
    }

    byName.set(name, {
      name,
      kind: typeof Reflect.get(math, name) === "function" ? "function" : "constant",
      summary: doc.description ?? "",
      signatures: doc.syntax ?? [],
      description: doc.description ?? "",
      category: doc.category,
      expressionExamples: doc.examples ?? [],
      seealso: doc.seealso ?? [],
    });
  }

  // A `create(all)` instance carries more keys than the module namespace — expression-language
  // constants like `PI` and reserved words like `true` can never be named exports. The sandbox
  // imports the namespace, so anything absent from it would be a name the model cannot actually
  // call, which is the confusion this tool exists to remove.
  return [...byName.values()].filter((member) => member.name in mathjs);
};

// The sandbox has no DOM, no network, no workers and no Node streams, so papaparse's file, URL,
// worker and stream forms can never run there. Any declaration naming one of these is left out of
// the docs entirely rather than documented with a caveat.
const PAPAPARSE_UNSUPPORTED = [
  "LocalFile",
  "LocalChunkSize",
  "RemoteChunkSize",
  "NODE_STREAM_INPUT",
  "WORKERS_SUPPORTED",
  "ParseAsyncConfigBase",
  "ParseLocalConfig",
  "ParseLocalConfigBase",
  "ParseLocalConfigStep",
  "ParseLocalConfigNoStep",
  "ParseRemoteConfig",
  "ParseRemoteConfigBase",
  "ParseRemoteConfigStep",
  "ParseRemoteConfigNoStep",
  "ParseWorkerConfig",
];

const runsInSandbox = (declaration: Node): boolean =>
  !declaration
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => PAPAPARSE_UNSUPPORTED.includes(identifier.getText()));

const toPapaparseMembers = (file: SourceFile): DocsMember[] => {
  const raw = [
    ...file
      .getFunctions()
      .filter(runsInSandbox)
      .map((declaration) => toRawMember(declaration.getName(), "function", declaration)),
    ...file
      .getClasses()
      .filter(runsInSandbox)
      .map((declaration) => toRawMember(declaration.getName(), "function", declaration)),
    ...file
      .getInterfaces()
      .filter(runsInSandbox)
      .map((declaration) => toRawMember(declaration.getName(), "interface", declaration)),
    ...file
      .getTypeAliases()
      .filter(runsInSandbox)
      .map((declaration) => toRawMember(declaration.getName(), "interface", declaration)),
    ...file
      .getVariableDeclarations()
      .filter(runsInSandbox)
      .map((declaration) =>
        toRawMember(declaration.getName(), "constant", declaration.getVariableStatementOrThrow()),
      ),
  ];

  return groupOverloads(raw.filter((entry) => entry.name.length > 0));
};

type LibrarySource = {
  library: DocsLibrary["library"];
  importHint: string;
  packagePath: string;
  members: () => DocsMember[] | Promise<DocsMember[]>;
};

const sources: LibrarySource[] = [
  {
    library: "mathjs",
    importHint: 'import math from "mathjs"',
    packagePath: "./node_modules/mathjs/package.json",
    members: () =>
      toMathjsMembers(project.addSourceFileAtPath("./node_modules/mathjs/types/index.d.ts")),
  },
  {
    library: "papaparse",
    importHint: 'import Papa from "papaparse"',
    packagePath: "./node_modules/papaparse/package.json",
    // Stored as .txt so the repo's TypeScript, lint and translation passes treat it as vendored
    // data rather than project source; ts-morph is handed the contents under a .d.ts name.
    members: async () =>
      toPapaparseMembers(
        project.createSourceFile(
          "papaparse.d.ts",
          await readFile("./src/lib/docs/vendor/papaparse/types.d.txt", "utf8"),
          { overwrite: true },
        ),
      ),
  },
];

for (const source of sources) {
  const library: DocsLibrary = {
    library: source.library,
    version: await readVersion(source.packagePath),
    importHint: source.importHint,
    members: (await source.members()).sort((left, right) => left.name.localeCompare(right.name)),
  };

  await writeFile(
    `${GENERATED_DIR}/${source.library}.json`,
    `${JSON.stringify(library, null, 2)}\n`,
  );

  console.warn(`${source.library}@${library.version}: ${library.members.length} members`);
}
