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
  `const searchCtx = Kit.createContext(dbKit, memoryKit)` and
  `type SearchCtx = Kits<[DbKit, MemoryKit]>`.
- `Kit.createContext(...)` creates the live kit context from one or more modules.
- `Kit.get(module)` returns the kit value from a kit module for direct use.
- `Kit.gen(...)` defines result-returning application logic.
- `Kit.serverFn(...)` adapts a kit function at the server boundary.

## Kit Modules

Kit files live under `src/lib/` and define named tuple modules with
`Kit.define(name, value)`. The value should expose bare `Result.tryPromise` — do
**not** wrap with `Result.await` inside the kit:

- `db-kit.ts` — `createDbKit(api)` with a closed `DbApi` (`run`, `transaction`)
- `memory-kit.ts` — `createMemoryKit(api)` with a closed `MemoryApi`
  (`listThreads`, `deleteThread`)
- `s3-kit.ts` — `createS3Kit(api)` with a closed `S3Api` (`deleteObject`,
  `deleteObjects`, `getObject`, …)
- `vector-kit.ts` — `createVectorKit(api)` with a closed `VectorApi`
  (`deleteVectors`)

After `Kit.createContext(dbKit, memoryKit)`, callers use the context:

- `ctx.db.run(operation)` → `Promise<Result<T, DatabaseError>>`
- `ctx.db.transaction(operation)` → `Promise<Result<T, DatabaseError>>`
- `ctx.memory.listThreads(input)` → `Promise<Result<StorageListThreadsOutput, MemoryError>>`
- `ctx.memory.deleteThread(input)` → `Promise<Result<void, MemoryError>>`
- `ctx.vector.deleteVectors(input)` → `Promise<Result<void, VectorError>>`

Each kit exports a mockable `*Api` surface: pass a `satisfies DbApi` /
`MemoryApi` / `S3Api` / `VectorApi` object to `createDbKit` /
`createMemoryKit` / `createS3Kit` / `createVectorKit` in tests.

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
- `Kit.serverFn` maps kit errors to **user-safe** `ServerFnError` copy. Never
  forward `error.message` / `cause` from kit infra errors to the client
  (same rule as AGENTS.md for raw provider text). Domain errors that already
  carry intentional user-facing copy (e.g. `FileUploadError` by reason) are
  the exception at the boundary.

## Context vs direct kit access

Prefer `Kit.createContext(...)` with `Kit.gen` / `Kit.serverFn` for application
logic. That keeps dependencies injectable so the same function can run with live
kits in production and fakes in tests.

Use `Kit.get(module)` only when the handler is so simple that wiring a full kit
action would be more boilerplate than it is worth. In that case, call the kit
value directly:

```ts
export const updateFileStatus = createServerFn({ method: "POST" })
  .inputValidator(updateFileStatusInputSchema)
  .middleware([fileAccessMiddleware])
  .handler(async ({ context, data }) => {
    const result = await Kit.get(dbKit).run((db) =>
      db
        .update(file)
        .set({ status: data.status })
        .where(eq(file.id, context.file.id))
    );

    if (result.isErr()) {
      throw new ServerFnError({
        message: "Failed to update file status",
        status: "server-error",
      });
    }
  });
```

## Dependency Direction

Kit functions should receive a kit context instead of importing live services
directly. This keeps the same logic usable with live kits in production and
fake kits in tests.

## Kit Call Sites

Inside `Kit.gen`, callers wrap kit promises with `Result.await` for sequential
ops:

```text
const topic = yield* Result.await(
  ctx.db.run((db) =>
    db.query.topic.findFirst({
      where: { id: input.topicId },
    })
  )
);
```

For parallel independent ops, use `Promise.all` on kit calls (each returns
`Promise<Result<…>>`), then `yield*` the resolved Results:

```ts
const [topicsResult, threadsResult] = await Promise.all([
  ctx.db.run((db) => db.select(...)),
  ctx.memory.listThreads(...),
]);

const topics = yield* topicsResult;
const threads = yield* threadsResult;
```

## Server Function File Shape

Follow the ordering used by
[`src/routes/_protected.search/-search-api.ts`](../../src/routes/_protected.search/-search-api.ts):

1. Imports: external packages first, then app modules. Import kit values and
   their exported kit types separately, for example `dbKit` plus `type DbKit`.
2. Constants: limits and other module-local tuning values near the top.
3. Pure helpers: small local functions used by the kit action, before the
   exported DTO types when they are implementation details.
4. Exported result DTO types: response shapes consumed by the route/client.
5. Internal input and context types: name the action input after the use case,
   for example `SearchItemsInput`, and define the kit context as
   `type SearchCtx = Kits<[DbKit, MemoryKit]>`.
6. Kit action: define the application logic with `Kit.gen(...)`. Destructure
   input in the parameter list when it improves readability.
7. Server input schema: put the Valibot `inputValidator` schema after the kit
   action, close to the `createServerFn` that uses it.
8. Live kit composition: create the live context with `Kit.createContext(...)`
   after the schema and before the exported server function. Name it `*Ctx`.
9. Exported server function: adapt the kit action with `Kit.serverFn(...)`,
   map every possible kit/domain error to `ServerFnError`, and pass the live
   context plus boundary-normalized input.
10. Client query helpers: put query input types and `queryOptions(...)`
    builders after the server function.

Action input types should contain already-normalized boundary values. For
example, authenticated users arrive as `SafeId<"user">`, while route/search
data is trimmed or defaulted at the server boundary before calling the kit
action. Result DTOs should be plain serializable shapes with strings for dates.

## Application Logic + Server Boundary

Define domain logic with `Kit.gen`, then adapt at the server boundary with
`Kit.serverFn`. Pass an optional second argument — an exhaustive `matchError`
handler map — to map kit errors to `ServerFnError`. Keep the exhaustive map at
the call site; shared helpers such as `toServerFnError.serverError(...)` should
only construct the mapped error.

Reference: [`src/routes/_protected.search/-search-api.ts`](../../src/routes/_protected.search/-search-api.ts)

```ts
type SearchCtx = Kits<[DbKit, MemoryKit]>;

const searchCtx = Kit.createContext(dbKit, memoryKit);

const searchItemsFn = Kit.gen(async function* (
  ctx: SearchCtx,
  { query, userId }: SearchItemsInput
) {
  const [topicsResult, threadsResult] = await Promise.all([
    ctx.db.run((db) => db.select(...)),
    ctx.memory.listThreads(...),
  ]);

  const topics = yield* topicsResult;
  const threads = yield* threadsResult;

  return Result.ok({ topics, threads });
});

const searchItemsServerFn = Kit.serverFn(searchItemsFn, {
  DatabaseError: () => toServerFnError.serverError("Database search failed"),
  MemoryError: () => toServerFnError.serverError("Memory search failed"),
});

export const searchItems = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    searchItemsServerFn(searchCtx, {
      userId: context.user.id,
      query: data.query.trim(),
    })
  );
```

`ServerFnError` lives in `src/lib/kit`. `Kit.serverFn` accepts a `Kit.gen`
action and an optional handler map; it applies `mapError` + `matchError`, then
returns the ok value or throws the mapped error. When the handler map is
omitted, the action must already return `Result<T, ServerFnError>`. Handlers
call the `Kit.serverFn` adapter only — never `.unwrap()` directly.

Use `status: "unauthorized"` in `ServerFnError` when mapping auth failures.
