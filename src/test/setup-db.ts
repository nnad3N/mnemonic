import { mkdirSync, readFileSync, realpathSync, rmSync } from "node:fs";

import { createClient } from "@libsql/client";
import { afterAll } from "vitest";

import { SCHEMA_SQL_PATH, TEST_DB_DIR, TEST_ENV } from "./env";

const projectRoot = realpathSync(`${import.meta.dirname}/../..`);
const dbDir = `${projectRoot}/${TEST_DB_DIR}`;
const schemaSql = readFileSync(`${projectRoot}/${SCHEMA_SQL_PATH}`, "utf8");

mkdirSync(dbDir, { recursive: true });

const dbPath = `${dbDir}/${crypto.randomUUID()}.db`;
const databaseUrl = `file:${dbPath}`;

const bootstrapClient = createClient({ url: databaseUrl });
await bootstrapClient.executeMultiple(schemaSql);
bootstrapClient.close();

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}

process.env.DATABASE_URL = databaseUrl;

afterAll(() => {
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
});
