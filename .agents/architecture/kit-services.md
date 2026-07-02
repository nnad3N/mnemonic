# Kit Services

This app is prototyping a small `Kit` pattern for testable backend logic. A
kit is one capability object, such as the database service. A merged kit is the
combined kit object created with `mergeKits(...)`.

## Naming

- Kits provide capabilities, for example `DbService`.
- `MergedKit` is the combined kit object created with `mergeKits(...)`.
- `Kit.gen(...)` defines result-returning application logic.
- `Kit.serverFn(...)` adapts a kit function at the server boundary.

## Dependency Direction

Kit functions should receive a merged kit instead of importing live services
directly. This keeps the same logic usable with live kits in production and
fake kits in tests.

```ts
const getTopic = Kit.gen(async function* (
  context: MergedKit<[DbService]>,
  input: { topicId: string }
) {
  const topic = yield* context.db((db) =>
    db.query.topic.findFirst({
      where: { id: input.topicId },
    })
  );

  return Result.ok(topic);
});
```

## Server Boundary

`ServerFnError` lives in `src/lib/kit` because it belongs to the
`Kit.serverFn` boundary. `Kit.serverFn` should only accept kit functions whose
error type extends `ServerFnError`; it awaits the result, returns the ok value,
and throws the error value for err results.

## Current Status

This is a prototype pattern. Do not refactor existing routes, middleware, or API
modules into this pattern unless that refactor is explicitly requested.
