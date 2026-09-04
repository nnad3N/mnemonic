import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "@/env";

import * as authSchema from "./auth-schema.server.ts";
import { authRelations } from "./auth-schema.server.ts";
import * as appSchema from "./schema.server.ts";
import { appRelations } from "./schema.server.ts";

export const schema = { ...appSchema, ...authSchema };

export const drizzleDb = drizzle({
  connection: env.DATABASE_URL,
  relations: { ...appRelations, ...authRelations },
});
