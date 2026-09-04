import { defineConfig } from "drizzle-kit";

import { env } from "@/env";

export default defineConfig({
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: ["./src/db/schema.server.ts", "./src/db/auth-schema.server.ts"],
  tablesFilter: ["!mastra_*", "!memory_*", "!file_embeddings_*"],
});
