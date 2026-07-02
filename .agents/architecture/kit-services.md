# Kit Services

This app is prototyping a small `Kit` pattern for testable backend logic. A
kit module is a named capability tuple, such as the database kit. A merged kit
is the combined kit object created with `mergeKits(...)`.

## Naming

- Kits provide named capabilities, for example `dbKit` from `src/lib/db-kit.ts`.
- `MergedKit` is the combined kit object created with `mergeKits(...)`.
- `Kit.gen(...)` defines result-returning application logic.
- `Kit.serverFn(...)` adapts a kit function at the server boundary.

## Kit Modules

Kit files live under `src/lib/` and define named tuple modules with
`defineKit(name, value)`. The value should expose bare `Result.tryPromise` — do
**not** wrap with `Result.await` inside the kit:

- `db-kit.ts` — `defineKit("db", operationHandler)`
- `memory-kit.ts` — `defineKit("memory", operationHandler)`

After `mergeKits(dbKit, memoryKit)`, callers use the merged context:

- `ctx.db(operation)` → `Promise<Result<T, DatabaseError>>`
- `ctx.memory(operation)` → `Promise<Result<T, MemoryError>>`

## Dependency Direction

Kit functions should receive a merged kit instead of importing live services
directly. This keeps the same logic usable with live kits in production and
fake kits in tests.

## Kit Call Sites

Inside `Kit.gen`, callers wrap kit promises with `Result.await` for sequential
ops:

```text
const topic = yield* Result.await(
  ctx.db((db) =>
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
  ctx.db((db) => db.select(...)),
  ctx.memory((memory) => memory.listThreads(...)),
]);

const topics = yield* topicsResult;
const threads = yield* threadsResult;
```

## Application Logic + Server Boundary

Define domain logic with `Kit.gen`, then adapt at the server boundary with
`Kit.serverFn`. Pass an optional second argument — an exhaustive `matchError`
handler map — to map kit errors to `ServerFnError`. No shared mapper helper.

Reference: [`src/routes/_protected.search/-search-api.ts`](../../src/routes/_protected.search/-search-api.ts)

```ts
const searchKit = mergeKits(dbKit, memoryKit);

const searchItemsFn = Kit.gen(async function* (
  ctx: Kits<[typeof dbKit, typeof memoryKit]>,
  input: { userId: string; query: string }
) {
  const [topicsResult, threadsResult] = await Promise.all([
    ctx.db((db) => db.select(...)),
    ctx.memory((memory) => memory.listThreads(...)),
  ]);

  const topics = yield* topicsResult;
  const threads = yield* threadsResult;

  return Result.ok({ topics, threads });
});

const searchItemsServerFn = Kit.serverFn(searchItemsFn, {
  DatabaseError: () =>
    new ServerFnError({
      message: "Something went wrong",
      status: "server-error",
    }),
  MemoryError: () =>
    new ServerFnError({
      message: "Something went wrong",
      status: "server-error",
    }),
});

export const searchItems = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) =>
    searchItemsServerFn(searchKit, {
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

## Current Status

This is a prototype pattern. Do not refactor existing routes, middleware, or API
modules into this pattern unless that refactor is explicitly requested.
