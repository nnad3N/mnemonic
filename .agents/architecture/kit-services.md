# Kit Services

`Kit` is the backend pattern for testable application logic. A kit module is a
named capability tuple, such as the database kit. A kit context is the combined
kit object created with `Kit.createContext(...)`.

## Naming

- Kit modules provide named capabilities, for example `dbKit` from
  `src/lib/db-kit.ts`. Module values and their types keep the `*Kit` suffix
  (`dbKit`, `type DbKit`).
- `Kits<[...]>` is the combined kit context type created by kit tuples.
- Live contexts and their type aliases use the `*Ctx` suffix, for example
  `const byokCtx = Kit.createContext(dbKit)` and
  `type ByokCtx = Kits<[DbKit]>`.
- `Kit.createContext(...)` creates the live kit context from one or more modules.
  **Never export the result.** The context belongs to the module that consumes
  the action — the server function, workflow step, or tool — as an unexported
  `const`. Exporting it ships one caller's dependency choice to every other
  caller, defeats the injection the kit exists for, and pulls the live `dbKit` /
  `s3Kit` imports into any module that imports it. A `.server.ts` module exports
  its `Kit.gen` actions and its `Kits<[...]>` type; the consumer supplies the
  context.
- `Kit.get(module)` returns the kit value from a kit module for direct use.
- `Kit.gen(...)` defines result-returning application logic.
- `Kit.promiseAll(...)` combines parallel Result promises into one typed Result.
- `Kit.run(...)` adapts an async Result-producing operation at a thin framework boundary that represents failure by throwing.

## Kit Modules

Kit files live under `src/lib/` and define named tuple modules with
`Kit.define(name, value)`. The value should expose bare `Result.tryPromise` — do
**not** wrap with `Result.await` inside the kit:

- `db-kit.ts` — `createDbKit(api)` with a closed `DbApi` (`run`, `transaction`)
- `memory-kit.ts` — `createMemoryKit(api)` with a closed `MemoryApi`
  (`getThreadById`, `saveThread`, `updateThread`, `listThreads`,
  `listMessages`, `saveMessages`, and deletion operations). Live
  implementation is a shared `Memory` over the store and vector.
- `s3-kit.ts` — `createS3Kit(api)` with a closed `S3Api` (`deleteObject`,
  `deleteObjects`, `getObject`, …)
- `vector-kit.ts` — `createVectorKit(api)` with a closed `VectorApi`
  (`createIndex`, `deleteVectors`, `upsert`)

After `Kit.createContext(dbKit, memoryKit)`, callers use the context:

- `ctx.db.run(operation)` → `Promise<Result<T, DatabaseError>>`
- `ctx.db.transaction(operation)` → `Promise<Result<T, DatabaseError>>`
- `ctx.memory.listThreads(input)` → `Promise<Result<StorageListThreadsOutput, MemoryError>>`
- `ctx.memory.getThreadById(input)` → `Promise<Result<StorageThreadType | null, MemoryError>>`
- `ctx.memory.listMessages(input)` → `Promise<Result<StorageListMessagesOutput, MemoryError>>`
- `ctx.memory.deleteThread(input)` → `Promise<Result<void, MemoryError>>`
- `ctx.vector.deleteVectors(input)` → `Promise<Result<void, VectorError>>`
- `ctx.s3.getObject(key)` → `Promise<Result<Uint8Array, S3Error>>`

Each kit exports a mockable `*Api` surface: pass a `satisfies DbApi` /
`MemoryApi` / `S3Api` / `VectorApi` object to the corresponding `create*Kit`
function in tests.

The shared Drizzle client is exported as `drizzleDb` from `src/db/index.ts`
because Better Auth needs the concrete client during framework initialization.
Application queries must still go through `dbKit`.

## Kit errors (Rust-style wrapping)

Kit tagged errors are the TypeScript analogue of `thiserror` types with
`#[source]`: a **fixed domain `message`** plus the original failure in
`cause`. Do **not** copy `cause.message` (or provider/SDK text) into
`message`.

```ts
// Good — stable Display, cause preserved for logs/debugging
const toMemoryError = (cause: unknown): MemoryError =>
  new MemoryError({
    cause,
    message: "Memory operation failed",
  });

// Bad — flattens the source into the wrapper's Display
new MemoryError({
  cause,
  message: cause instanceof Error ? cause.message : "Memory operation failed",
});
```

Rules:

- Wrap catch handlers always use a constant domain string
  (`"Database operation failed"`, `"S3 operation failed"`, …).
- Keep structured metadata from SDKs when useful (`code`, `requestId`,
  `statusCode` on `S3Error`) — that is not the same as copying Display text.
- Kits should not `throw` the same tagged error their catch maps to. Return
  `Result.err(...)` for domain failures, or let foreign exceptions hit the
  wrap handler. (`s3Kit` is the exception: AWS response shapes force a few
  `throw new S3Error` paths, so `toS3Error` re-returns `S3Error.is`.)
- Server-function `Kit.run(...).throws(...)` mappings convert kit errors to
  **user-safe** `ServerFnError` copy. Never
  forward `error.message` / `cause` from kit infra errors to the client
  (same rule as AGENTS.md for raw provider text). Domain errors that already
  carry intentional user-facing copy (e.g. `FileUploadError` by reason) are
  the exception at the boundary.

## Context vs direct kit access

Prefer `Kit.createContext(...)` with `Kit.gen` for application logic, then use
`Kit.run` only in the thin framework adapter. That keeps dependencies injectable
so the same function can run with live kits in production and fakes in tests.

Use `Kit.get(module)` only when the handler is so simple that wiring a full kit
action would be more boilerplate than it is worth. In that case, call the kit
value directly:

```ts
export const getFileDownloadUrl = createServerFn({ method: "GET" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) => {
    const result = await Kit.get(s3Kit).getPresignedGetUrl({
      expiresIn: FILE_DOWNLOAD_URL_TTL_SECONDS,
      key: context.file.s3Key,
    });

    if (Result.isError(result)) {
      throw toServerFnError.serverError("Failed to get file download URL");
    }

    return { url: result.value };
  });
```

Reference: [`get-file-download-url.ts`](../../src/routes/_protected.topic.$topicId/-files-api/get-file-download-url.ts)

Do not create a kit solely to wrap one SDK call used by one server function.
Keep that call at its owning boundary with `Result.tryPromise(...)`. Kits are
for reusable capabilities or dependencies that application actions need to
inject and compose.

## Dependency Direction

Kit functions should receive a kit context instead of importing live services
directly. This keeps the same logic usable with live kits in production and
fake kits in tests.

## Kit Call Sites

Inside `Kit.gen`, compose sequential kit promises with `yield* await`:

```ts
const topic =
  yield *
  (await ctx.db.run((db) =>
    db.query.topic.findFirst({
      where: { id: input.topicId },
    }),
  ));
```

For parallel independent ops, use `Kit.promiseAll` on kit calls (each returns
`Promise<Result<…>>`), then yield the combined Result once:

```ts
const [topics, threads] = yield* await Kit.promiseAll([
  ctx.db.run((db) => db.select(...)),
  ctx.memory.listThreads(...),
]);
```

`Kit.promiseAll` starts with the same concurrency as `Promise.all`, waits for
all member promises, preserves successful values in input order, and infers the
union of member error types. Keep a bespoke `Promise.all` loop when results must
remain paired with source records or need per-item handling.

## Server Function File Shape

A feature splits across two modules, per the suffix rules in `AGENTS.md`:
[`-byok.server.ts`](../../src/routes/_protected.settings/-byok.server.ts) holds
the server-only application logic, and
[`-byok.functions.ts`](../../src/routes/_protected.settings/-byok.functions.ts)
holds the `createServerFn` wrappers and the query options the client imports.

`*.server.ts`, in order:

1. Imports: external packages first, then app modules. Import kit **types**
   only — `type DbKit`, not `dbKit`. The live kits belong to the consumer.
2. Constants and pure helpers used by the actions.
3. The context type: `type ByokCtx = Kits<[DbKit]>`.
4. Internal input types, named after the use case (`CreateByokInput`).
5. Exported kit actions defined with `Kit.gen(...)`, each taking `ctx` first.
   Destructure input in the parameter list when it improves readability.

`*.functions.ts`, in order:

1. Imports, including the live kits and the actions from the `.server.ts`
   sibling.
2. The unexported live context: `const byokCtx = Kit.createContext(dbKit)`.
3. A shared boundary error mapper when several server functions map the same
   error union.
4. Exported result DTO types consumed by the route and client.
5. `createServerFn` definitions: `validator` schema inline, then `middleware`,
   then a handler that directly returns
   `Kit.run(async () => action(byokCtx, input)).throws<ServerFnError>(...)`.
6. The feature's `xQueries` object, next to the read server functions it wraps.
   Query keys live inside those `queryOptions` — see `AGENTS.md`.

Action input types should contain already-normalized boundary values. For
example, authenticated users arrive as `SafeId<"user">`, while route/search
data is trimmed or defaulted at the server boundary before calling the kit
action. Result DTOs should be plain serializable shapes.

## Application Logic + Server Boundary

Define domain logic with `Kit.gen`, then adapt it at the server boundary with a
directly returned `Kit.run(...).throws(...)` chain. Use `matchError` inside the
mapper to exhaustively translate tagged kit errors to `ServerFnError`. Keep the
exhaustive map at the call site; shared helpers such as
`toServerFnError.serverError(...)` should only construct the mapped error.

```ts
// search.server.ts — exports the action, never the context
export type SearchCtx = Kits<[DbKit, MemoryKit]>;

export const searchItemsFn = Kit.gen(async function* (
  ctx: SearchCtx,
  { query, userId }: SearchItemsInput
) {
  const [topics, threads] = yield* await Kit.promiseAll([
    ctx.db.run((db) => db.select(...)),
    ctx.memory.listThreads(...),
  ]);

  return Result.ok({ topics, threads });
});
```

```ts
// search.functions.ts — owns the live context
const searchCtx = Kit.createContext(dbKit, memoryKit);

export const searchItems = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    Kit.run(async () =>
      searchItemsFn(searchCtx, {
        userId: context.user.id,
        query: data.query.trim(),
      }),
    ).throws<ServerFnError>((error) =>
      matchError(error, {
        DatabaseError: () => toServerFnError.serverError("Database search failed"),
        MemoryError: () => toServerFnError.serverError("Memory search failed"),
      }),
    ),
  );
```

`ServerFnError` lives in `src/lib/errors/server-fn-error.ts`, built through the
`toServerFnError` helpers. `.throws<ServerFnError>(mapper)` returns
the successful action value or throws the mapped boundary error. The mapper
receives the complete source error union. If that union already contains
`ServerFnError`, pass it through as another `matchError` key —
`ServerFnError: (error) => error` — so the mapping stops
compiling if the action ever stops producing that variant. Never expose kit
infrastructure messages or call Better Result's `.unwrap()` at the boundary.

`Kit.run` is intentionally narrow. Use it only for a thin server-function,
workflow, or tool adapter that directly returns the successful value. Do not
replace ordinary Result branching in application logic, middleware, client
code, recovery paths, transformed-success handlers, or multi-step functions.
`inspect` and `inspectErr` are synchronous observation hooks for the rare
boundary side effect needed before `throws`.

## Non-server Framework Boundaries

Use `Kit.run(...).throws()` when a framework such as Mastra represents failure
with a thrown `Error`. It returns successful values and throws the original
error instance, preserving tagged error identity and metadata. Do not replace
it with Better Result's `.unwrap()`, which converts an `Err` into a `Panic`.

```ts
const mastraStep = createStep({
  // ...
  execute: async ({ inputData }) =>
    Kit.run(async () => processStepFn(processCtx, inputData)).throws(),
});
```

Bare `.throws()` does not sanitize errors for a client. Use
`.throws<ServerFnError>(...)` with exhaustive, user-safe mappings at
server-function boundaries.

Use `status: "unauthorized"` in `ServerFnError` when mapping auth failures.
