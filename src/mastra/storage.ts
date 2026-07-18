import { LibSQLStore, LibSQLVector } from "@mastra/libsql";

import { env } from "@/env";

const libsqlConnection = {
  url: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
};

export const libsqlStore = new LibSQLStore({
  id: "mnemonic-libsql-storage",
  ...libsqlConnection,
});

export const libsqlVector = new LibSQLVector({
  id: "mnemonic-libsql-vector",
  ...libsqlConnection,
});

/** Mastra vector store key; includes embedder id so model changes can reindex into a new store. */
export const VECTOR_STORE_NAME = "libsql-vector-v1";
