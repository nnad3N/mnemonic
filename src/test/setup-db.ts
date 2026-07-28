import { createClient } from "@libsql/client";
import { afterAll } from "vitest";

import { SCHEMA_SQL_PATH, TEST_DB_DIR, TEST_ENV } from "./env";

const projectRoot = Deno.realPathSync(`${import.meta.dirname}/../..`);
const dbDir = `${projectRoot}/${TEST_DB_DIR}`;
const schemaSql = Deno.readTextFileSync(`${projectRoot}/${SCHEMA_SQL_PATH}`);

Deno.mkdirSync(dbDir, { recursive: true });

const dbPath = `${dbDir}/${crypto.randomUUID()}.db`;
const databaseUrl = `file:${dbPath}`;

const bootstrapClient = createClient({ url: databaseUrl });
await bootstrapClient.executeMultiple(schemaSql);
bootstrapClient.close();

for (const [key, value] of Object.entries(TEST_ENV)) {
  Deno.env.set(key, value);
}

Deno.env.set("DATABASE_URL", databaseUrl);

const removeIfExists = (path: string) => {
  try {
    Deno.removeSync(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
};

afterAll(() => {
  removeIfExists(dbPath);
  removeIfExists(`${dbPath}-wal`);
  removeIfExists(`${dbPath}-shm`);
});
