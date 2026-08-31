# Replace libsql/SQLite with Postgres, using PGlite as the test database

## Want

Remove `@libsql/client` and `@mastra/libsql` from mnemonic. The app runs on Postgres — app tables
through Drizzle, Mastra storage and vectors through `@mastra/pg`/pgvector. Dev gets a Postgres
container alongside the services already in `docker-compose.yml`. Vitest runs against PGlite,
reached over the Postgres wire protocol so `@mastra/pg` works unchanged.

The schema is rewritten as idiomatic Drizzle Postgres, not transliterated from the SQLite one.

## Decisions

- **Nuke, don't migrate.** The app is not deployed and holds nothing worth keeping. The new
  database starts empty; no SQLite→Postgres data pump.
- **Dev on real Postgres.** A Postgres+pgvector service joins `docker-compose.yml`; dev matches
  prod. PGlite is confined to Vitest, where per-worker startup cost is what it buys.
- **Idiomatic Postgres schema.** Follow the Drizzle Postgres docs for every column — no
  copy-paste of SQLite shapes. `integer(..., { mode: "timestamp_ms" })` becomes `timestamp` with
  `defaultNow()`, `text(..., { mode: "json" })` becomes `jsonb`, and `now` in `sql.server.ts`
  disappears along with the hand-built `ilike`, which Drizzle ships natively for Postgres.
- **`text` columns, not `pgEnum`.** Union-typed columns stay `text().$type<T>()`. A `pgEnum`
  would need an `ALTER TYPE` migration every time a value is added, which is too much friction
  for a status list that changes with the feature set.
- **Driver: `drizzle-orm/node-postgres`.** `@mastra/pg` already depends on `pg`, so the app and
  Mastra share one client library and no second driver enters the tree.
- **Schema workflow unchanged.** Still `db:push`, no `drizzle/` migration history.
- **No retry loop in `db-kit`.** `LOCK_RETRY`/`isLockedError` are deleted outright. They exist
  only because libsql fails instantly on `SQLITE_BUSY`/`SQLITE_LOCKED`; Postgres waits on locks,
  and adding a `40001` serialization retry would be defensive code for a condition `READ COMMITTED`
  cannot produce here.
- **`hnsw` vector index.** Set at the one `createIndex` call site
  (`upload-file-workflow.server.ts:183`) with library defaults. `ivfflat`, the `PgVector` default,
  silently loses recall on the near-empty indexes a fresh install and every test run start from.
- **Role-based names.** `libsqlStore`/`libsqlVector` become `mastraStore`/`mastraVector`, and
  `VECTOR_STORE_NAME` becomes `"vector-v002"` — the engine is a detail of `storage.server.ts`, and
  the version bump forces the reindex that a vector-store swap needs anyway.
- **Mastra keeps its tables in `public`.** The `tablesFilter: ["!mastra_*", "!memory_*",
"!file_embeddings_*"]` fence in `drizzle.config.ts` stays exactly as it is. Moving Mastra to its
  own Postgres schema is unrelated to removing libsql.
- **`sql.server.ts` keeps `ilike` and `startsWith`, loses `now`.** Both helpers keep their wildcard
  escaping and their `undefined` overload, but are rewritten over Drizzle's native `ilike`/`like`
  operators — Postgres already treats `\` as the `LIKE` escape character, so the explicit `ESCAPE`
  clause goes. `sql.server.test.ts` stays valid unchanged.
- **Mastra gets bumped first, in its own commit.** `@mastra/pg` requires `@mastra/core >= 1.63.1`
  against the pinned `1.59.0`, so `@mastra/*` and the `mastra` CLI move to latest on libsql and the
  suite has to be green before the migration starts. A behaviour change in a Mastra minor then
  fails on its own, not inside a diff that rewrites every table.
- **Dev Postgres in compose.** A `postgres` service on `pgvector/pgvector:pg18` (pinned — the
  server version matters), database/user/password `mnemonic`, published on 5432, a `postgres_data`
  volume and a `pg_isready` healthcheck. `DATABASE_AUTH_TOKEN` is deleted from `env.ts`,
  `.env.example` and `drizzle.config.ts`; `DATABASE_URL` becomes a `postgres://` string. Note that
  `docker:reset` now wipes the dev database too.
- **The better-auth schema is regenerated.** Flip `drizzleAdapter` to `provider: "pg"` and rerun
  `@better-auth/cli generate` rather than hand-porting `auth-schema.server.ts`; diff the output so
  the hand-added `session_userId_idx` and the `defineRelationsPart` block come back deliberately.
- **Tests bridge PGlite to `@mastra/pg`.** `@electric-sql/pglite-socket` serves PGlite over the
  Postgres wire protocol so `PostgresStore` and `PgVector` connect to the same in-process database
  Drizzle uses. No container in the test loop, and the existing vector assertions keep working.
  If the bridge turns out not to work, we decide then — no fallback is planned in advance.

## Facts

- libsql surfaces (18 call sites): `src/db/client.server.ts`, `src/mastra/storage.server.ts`,
  `src/lib/db-kit.server.ts` (`LibsqlError` + SQLITE_BUSY/LOCKED retry), `src/lib/vector-kit.server.ts`,
  `src/lib/memory-kit.server.ts`, `src/mastra/instance.server.ts`, `src/mastra/agent-memory.server.ts`,
  `src/mastra/agents/{worker,reader}-agent.server.ts`, `src/test/{setup-db,clear-database}.ts`,
  `drizzle.config.ts`, and 4 test files that call `libsqlVector.query`.
- Schema is `sqliteTable` throughout: `src/db/schema.server.ts` (278 lines), `auth-schema.server.ts`
  (128), `mastra-schema.server.ts` (11, a read-only mirror of Mastra's `mastra_threads`).
- Union-typed columns are plain `text().$type<T>()`: `FileStatus`, `ThreadRunStatus`,
  `NoteVersionAuthor`, `ModelCapability` (the last has a literal array,
  `modelCapabilityLevels` in `src/lib/model-capability.ts`).
- JSON columns: `threadRun.versionedNoteIds`, `threadReply.workTimings`.
- `noteVersion.updatedAt` carries a `.default(sql\`0\`)` workaround for SQLite's constant-only
  ADD COLUMN, which Postgres does not need.
- better-auth is wired with `drizzleAdapter(drizzleDb, { provider: "sqlite", ... })`
  (`src/lib/better-auth/auth.server.ts:27`).
- No `drizzle/` migrations folder exists; tests build the schema from `drizzle-kit export --sql`
  (`src/test/global-setup.ts`) and each worker gets its own `file:` SQLite db
  (`src/test/setup-db.ts`).
- `@mastra/pg@1.22.2` ships `PostgresStore` + `PgVector` (pgvector), depends on `pg@^8.22`, and
  accepts a connection string, host/port fields, or a `pg.ClientConfig`. Its peer is
  `@mastra/core >=1.63.1`; this repo pins `@mastra/core@1.59.0`, latest is `1.63.2`, so a Mastra
  bump rides along.
- PGlite: `@electric-sql/pglite@0.5.8`; pgvector is a separate package,
  `@electric-sql/pglite-pgvector@0.0.9`. `@electric-sql/pglite-socket@0.2.11` exposes PGlite over
  the Postgres wire protocol.
- Drizzle has a first-party `drizzle-orm/pglite` driver, so app queries in tests could hit PGlite
  directly without the socket.
- `pgvector/pgvector` publishes `pg18`/`pg17`/... tags (currently pgvector 0.8.6).
- `PgVector` runs `CREATE EXTENSION IF NOT EXISTS vector` itself, so no database init script is
  needed — the extension only has to be _available_, which is what `@electric-sql/pglite-pgvector`
  provides under PGlite.
- Both `PostgresStore` and `PgVector` take a `schemaName` option (default `public`), and `PgVector`
  sets `search_path` so its operators resolve from a non-default schema. `@mastra/pg` also exports
  `exportSchemas(schemaName?)`, which emits Mastra's DDL without a connection.
- Mastra's Postgres tables keep the `mastra_threads` name, so `mastra-schema.server.ts` stays valid
  as a mirror.
- `.env.example` documents `DATABASE_URL="file:./data/mnemonic.db"` and an optional
  `DATABASE_AUTH_TOKEN`; both need rewriting.
- `VECTOR_STORE_NAME = "libsql-vector-v001"` is read by `instance.server.ts`,
  `file-vector-search-tool.server.ts` and `file-graph-rag-tool.server.ts`.

## Test harness

`global-setup.ts` keeps exporting schema SQL with `drizzle-kit export --sql`, now in the Postgres
dialect. Each worker boots an in-memory PGlite with `@electric-sql/pglite-pgvector` loaded, applies
that SQL, and starts a `PGLiteSocketServer` on a per-worker Unix socket under `node_modules/.vitest/`.
`DATABASE_URL` points at that socket, so Drizzle, `PostgresStore` and `PgVector` all land on the same
instance. Mastra's tables are pre-created in the same bootstrap by applying `exportSchemas()` from
`@mastra/pg`, rather than left to Mastra's own lazy `init()` on first store use.
`clear-database.ts` collapses to `TRUNCATE ... RESTART IDENTITY CASCADE` over every
non-system table — the F32_BLOB special case and the drop-and-recreate dance disappear, since a
pgvector index survives a truncate.

PGlite boots in roughly 200-500ms per worker plus schema load, against SQLite's near-zero, so suite
startup gets slower. If that becomes a problem, `@electric-sql/pglite-prepopulatedfs` can snapshot a
post-schema data directory; not worth building until it is measurably slow.

## Out of scope

- Migrating existing libsql data.
- Moving Mastra's tables into a dedicated Postgres schema.

## Done means

`nub run typecheck`, `nub run lint` and the full `nub run test` green against PGlite, no `libsql`
references left in the tree, and `@libsql/client` and `@mastra/libsql` gone from `package.json`.
