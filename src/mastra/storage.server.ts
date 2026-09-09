import { PgVector, PostgresStore } from "@mastra/pg";

import { env } from "@/env";

export const mastraStore = new PostgresStore({
  id: "mnemonic-storage",
  connectionString: env.DATABASE_URL,
});

export const mastraVector = new PgVector({
  id: "mnemonic-vector",
  connectionString: env.DATABASE_URL,
});

/** Mastra vector store key; includes embedder id so model changes can reindex into a new store. */
export const VECTOR_STORE_NAME = "mastra-vector-v001";
