import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "@/env";

import * as authSchema from "./auth-schema.ts";
import { authRelations } from "./auth-schema.ts";
import * as appSchema from "./schema.ts";
import { appRelations } from "./schema.ts";

export const schema = { ...appSchema, ...authSchema };

const client = createClient({
  url: env.DATABASE_URL,
  authToken: env.DATABASE_AUTH_TOKEN,
});

export const drizzleDb = drizzle({
  client,
  relations: { ...appRelations, ...authRelations },
});
