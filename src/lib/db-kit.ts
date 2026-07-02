import { Result, TaggedError } from "better-result";

import { db as drizzleDb } from "@/db";
import { Kit } from "@/lib/kit";

type DrizzleDb = typeof drizzleDb;
type DbTransaction = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

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

const run = async <TValue>(operation: (db: DrizzleDb) => Promise<TValue>) =>
  Result.tryPromise({
    try: async () => operation(drizzleDb),
    catch: toDatabaseError,
  });

const transaction = async <TValue>(
  operation: (tx: DbTransaction) => Promise<TValue>
) =>
  Result.tryPromise({
    try: async () => drizzleDb.transaction(async (tx) => operation(tx)),
    catch: toDatabaseError,
  });

export const dbKit = Kit.define("db", {
  run,
  transaction,
});

export type DbKit = typeof dbKit;
