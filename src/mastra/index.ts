import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";

import { env } from "../env";
import { mnemonicAgent } from "./agents/mnemonic-agent";

export const mastra = new Mastra({
  agents: { mnemonicAgent },
  storage: new PostgresStore({
    id: "mnemonic-postgres-storage",
    connectionString: env.DATABASE_URL,
  }),
});
