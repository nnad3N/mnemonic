import { PostgresStore, PgVector } from "@mastra/pg";

import { env } from "@/env";

export const postgresStore = new PostgresStore({
  id: "mnemonic-postgres-storage",
  connectionString: env.DATABASE_URL,
});

export const pgVector = new PgVector({
  id: "mnemonic-pg-vector",
  connectionString: env.DATABASE_URL,
});
