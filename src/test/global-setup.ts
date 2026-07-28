import { SCHEMA_SQL_PATH, TEST_ENV } from "./env";

const projectRoot = Deno.realPathSync(`${import.meta.dirname}/../..`);
const schemaSqlPath = `${projectRoot}/${SCHEMA_SQL_PATH}`;
const drizzleKitBin = `${projectRoot}/node_modules/drizzle-kit/bin.cjs`;

const dirname = (path: string) => path.slice(0, path.lastIndexOf("/"));

const exportSchemaSql = () => {
  const result = new Deno.Command("deno", {
    args: ["run", "-A", drizzleKitBin, "export", "--sql"],
    cwd: projectRoot,
    env: {
      ...Deno.env.toObject(),
      ...TEST_ENV,
    },
    stdout: "piped",
    stderr: "piped",
  }).outputSync();

  const stdout = new TextDecoder().decode(result.stdout);
  const stderr = new TextDecoder().decode(result.stderr);

  if (!result.success) {
    throw new Error(
      `drizzle-kit export failed (status ${String(result.code)}):\n${stderr}\n${stdout}`,
    );
  }

  const sql = stdout.trim();

  Deno.mkdirSync(dirname(schemaSqlPath), { recursive: true });
  Deno.writeTextFileSync(schemaSqlPath, `${sql}\n`);
};

export default function setup() {
  exportSchemaSql();
}
