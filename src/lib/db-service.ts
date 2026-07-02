import { Result, TaggedError } from "better-result";

import { db as drizzleDb } from "@/db";
import { defineKit } from "@/lib/kit";

type DrizzleDb = typeof drizzleDb;

export class DatabaseError extends TaggedError("DatabaseError")<{
  cause: unknown;
  message: string;
}>() {}

const toDatabaseError = (cause: unknown): DatabaseError =>
  new DatabaseError({
    cause,
    message:
      cause instanceof Error ? cause.message : "Database operation failed",
  });

export const dbService = defineKit({
  db: async <TValue>(operation: (db: DrizzleDb) => Promise<TValue>) =>
    Result.tryPromise({
      try: async () => operation(drizzleDb),
      catch: toDatabaseError,
    }),
});

export type DbService = typeof dbService;
