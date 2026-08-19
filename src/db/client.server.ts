import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "@/env";

import * as authSchema from "./auth-schema.server.ts";
import { authRelations } from "./auth-schema.server.ts";
import * as appSchema from "./schema.server.ts";
import { appRelations } from "./schema.server.ts";

export const schema = { ...appSchema, ...authSchema };

const BUSY_TIMEOUT_MS = 5000;

const client = createClient({
  url: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
  timeout: BUSY_TIMEOUT_MS,
});

export const drizzleDb = drizzle({
  client,
  relations: { ...appRelations, ...authRelations },
});
