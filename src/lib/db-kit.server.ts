import { LibsqlError } from "@libsql/client";
import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";
import { DrizzleQueryError } from "drizzle-orm/errors";

import { drizzleDb } from "@/db/client.server";
import * as Kit from "@/lib/kit";

type DrizzleDb = typeof drizzleDb;
type DbTransaction = Parameters<Parameters<DrizzleDb["transaction"]>[0]>[0];

export class DatabaseError extends TaggedError("DatabaseError")<{
  cause: unknown;
  message: string;
}> {}

export type DbApi = {
  run: <TValue>(
    operation: (db: DrizzleDb) => Promise<TValue>,
  ) => Promise<ResultType<TValue, DatabaseError>>;
  transaction: <TValue>(
    operation: (tx: DbTransaction) => Promise<TValue>,
  ) => Promise<ResultType<TValue, DatabaseError>>;
};

export const createDbKit = (api: DbApi) => Kit.define("db", api);

// libsql does not wait for a held lock on a local file: a second writer fails at once with
// SQLITE_BUSY, and a writer that collides with a read on its own connection with SQLITE_LOCKED.
// Neither statement ran, so the only fix is to run it again.
const isLockedError = (error: DatabaseError) => {
  const cause = error.cause instanceof DrizzleQueryError ? error.cause.cause : error.cause;

  return (
    cause instanceof LibsqlError && (cause.code === "SQLITE_BUSY" || cause.code === "SQLITE_LOCKED")
  );
};

const LOCK_RETRY = {
  times: 3,
  delayMs: 50,
  backoff: "exponential" as const,
  jitter: true,
  shouldRetry: isLockedError,
};

export const dbKit = createDbKit({
  run: async (operation) =>
    Result.tryPromise(
      {
        try: async () => operation(drizzleDb),
        catch: (cause) => new DatabaseError({ cause, message: "Database query failed" }),
      },
      { retry: LOCK_RETRY },
    ),
  transaction: async (operation) =>
    Result.tryPromise(
      {
        try: async () => drizzleDb.transaction(async (tx) => operation(tx)),
        catch: (cause) => new DatabaseError({ cause, message: "Database transaction failed" }),
      },
      { retry: LOCK_RETRY },
    ),
});

export type DbKit = typeof dbKit;
