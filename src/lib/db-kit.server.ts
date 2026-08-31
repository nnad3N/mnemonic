import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";

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

export const dbKit = createDbKit({
  run: async (operation) =>
    Result.tryPromise({
      try: async () => operation(drizzleDb),
      catch: (cause) => new DatabaseError({ cause, message: "Database query failed" }),
    }),
  transaction: async (operation) =>
    Result.tryPromise({
      try: async () => drizzleDb.transaction(async (tx) => operation(tx)),
      catch: (cause) => new DatabaseError({ cause, message: "Database transaction failed" }),
    }),
});

export type DbKit = typeof dbKit;
