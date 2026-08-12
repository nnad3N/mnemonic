import { spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { SCHEMA_SQL_PATH, TEST_ENV } from "./env";

const projectRoot = realpathSync(`${import.meta.dirname}/../..`);
const schemaSqlPath = `${projectRoot}/${SCHEMA_SQL_PATH}`;
const drizzleKitBin = `${projectRoot}/node_modules/drizzle-kit/bin.cjs`;

const exportSchemaSql = () => {
  const result = spawnSync(process.execPath, [drizzleKitBin, "export", "--sql"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...TEST_ENV,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `drizzle-kit export failed (status ${String(result.status)}):\n${result.stderr}\n${result.stdout}`,
    );
  }

  const sql = result.stdout.trim();

  mkdirSync(dirname(schemaSqlPath), { recursive: true });
  writeFileSync(schemaSqlPath, `${sql}\n`);
};

export default function setup() {
  exportSchemaSql();
}
