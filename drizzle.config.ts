import { defineConfig } from "drizzle-kit";

import { env } from "@/env";

export default defineConfig({
  dbCredentials: {
    authToken: env.DATABASE_AUTH_TOKEN,
    url: env.DATABASE_URL,
  },
  dialect: "turso",
  out: "./drizzle",
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
});
