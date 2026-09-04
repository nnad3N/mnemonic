import { Client } from "pg";
import { afterAll, inject } from "vitest";

import { TEST_ENV } from "./env";

const adminUrl = inject("pgUrl");

const workerDbName = `test_${crypto.randomUUID().replaceAll("-", "")}`;

const admin = new Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`CREATE DATABASE "${workerDbName}"`);
await admin.end();

const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${workerDbName}`;

const bootstrap = new Client({ connectionString: databaseUrl.href });
await bootstrap.connect();
await bootstrap.query(inject("schemaSql"));
await bootstrap.end();

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}

process.env.DATABASE_URL = databaseUrl.href;

afterAll(async () => {
  const { drizzleDb } = await import("@/db/client.server");
  const { mastraStore, mastraVector } = await import("@/mastra/storage.server");
  await Promise.all([drizzleDb.$client.end(), mastraStore.close(), mastraVector.disconnect()]);
});
