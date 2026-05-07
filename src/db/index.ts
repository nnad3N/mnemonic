import { drizzle } from "drizzle-orm/bun-sql";

import { env } from "@/env";

import * as authSchema from "./auth-schema.ts";
import { authRelations } from "./auth-schema.ts";
import * as appSchema from "./schema.ts";
import { appRelations } from "./schema.ts";

export const schema = { ...appSchema, ...authSchema };

export const db = drizzle(env.DATABASE_URL, {
  relations: { ...appRelations, ...authRelations },
});
