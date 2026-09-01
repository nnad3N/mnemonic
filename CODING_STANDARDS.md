# Coding standards

How to write code in Mnemonic. Generic TypeScript lives in the `typescript-best-practices` skill. Lint and format are in [`oxlint.config.ts`](oxlint.config.ts) and `tools/oxlint/anti-slop/`. This file is the project conventions those cannot see.

## Contents

- [Returns](#returns)
- [Async](#async)
- [React](#react)
- [TanStack Query](#tanstack-query)
- [Error handling](#error-handling)
- [Kit](#kit)
- [Code organization](#code-organization)
- [TanStack Router](#tanstack-router)
- [Server and client](#server-and-client)
- [Valibot](#valibot)
- [Forms](#forms)
- [AI SDK tool parts](#ai-sdk-tool-parts)
- [Internationalization](#internationalization)
- [Database and Temporal](#database-and-temporal)
- [SafeId](#safeid)

---

## Returns

Brace a `return` that yields a value. The only one-line return is the bare `return;`.

```ts
if (!open) return;

if (readOnly) {
  return null;
}
```

---

## Async

Do not use `void` to silence an unhandled-promise warning. `void` is correct in two cases: the callback's signature is fixed as synchronous by a library and cannot be made `async`, or the call is genuinely fire-and-forget. Everywhere else, `await`.

Event handlers can be `async`. Make them so. `void form.handleSubmit()` is wrong:

```tsx
onSubmit={async (event) => {
  event.preventDefault();
  event.stopPropagation();
  await form.handleSubmit();
}}
```

---

## React

Prefer arrow function components. Implicit-return `() => (...)` when the body is only JSX. Components that call hooks use a block body.

Define a named `ComponentNameProps` type for each component. Do not inline the props object type in the parameter list.

Pass `ref` as a prop. Do not use `React.forwardRef`.

Do not add `aria-label` or `title`.

Do not add a helper that maps a discriminant to Tailwind class strings (`getStatusClassName` with a `switch`). Inline classes in JSX with `cn(..., condition && "class")`, or extract a small component that owns the variant markup.

Keep static Tailwind class strings inline in JSX unless extracting a component or using `cn(...)` makes a conditional readable. Do not create a local constant whose only job is a reusable Tailwind string for one file.

```tsx
// Good. Inline.
<span
  className={cn(
    "size-1.5 rounded-full",
    status === "ready" && "bg-green-500",
    status === "failed" && "bg-red-500",
  )}
/>;

// Good. Component owns the variants.
type FileStatusChipProps = { status: FileStatus };

const FileStatusChip = ({ status }: FileStatusChipProps) => (
  <Badge variant="outline">
    <span
      className={cn(
        "size-1.5 rounded-full",
        status === "ready" && "bg-green-500",
        status === "failed" && "bg-red-500",
      )}
    />
  </Badge>
);

// Bad. Class-string lookup helper.
const getStatusDotClassName = (status: FileStatus) => {
  switch (status) {
    case "ready":
      return "bg-green-500";
  }
};
```

---

## TanStack Query

Define reusable `queryOptions(...)` / `infiniteQueryOptions(...)` builders and pass those objects to `useQuery` / `useInfiniteQuery`.

Do not pass explicit generics to `useQuery`, `useInfiniteQuery`, `queryOptions`, `infiniteQueryOptions`, or `queryClient.setQueryData`. Infer from the query function and the options' `queryKey`.

When updating nested query data, use Immer `produce` instead of spread-heavy reconstruction.

Do not destructure and rename several fields from a query hook. Keep the result object and name it after the domain (`const threads = useInfiniteQuery(...)`). No `Query` suffix. If the component only needs `data`, destructure that one field: `const { data: topicId } = useSuspenseQuery(...)`.

### Query keys live inside their query options

A feature exports one `xQueries` object that holds the key hierarchy and the fetching. There is no standalone key factory. Follow [TkDodo's Query Options API](https://tkdodo.eu/blog/the-query-options-api).

```ts
export const byokQueries = {
  all: () => ["byok"] as const,
  mine: () =>
    queryOptions({
      queryFn: async () => listMyByok(),
      queryKey: [...byokQueries.all(), "mine"] as const,
    }),
  user: (userId: string) =>
    queryOptions({
      queryFn: async () => listUserByok({ data: { userId } }),
      queryKey: [...byokQueries.all(), "user", userId] as const,
    }),
};
```

- Every entry is a function, including `all`. A property evaluated eagerly cannot reference `byokQueries` while the object is still being constructed.
- Leaf entries return `queryOptions(...)`. Grouping entries (`all`, and any intermediate level) return a bare key array used only as an invalidation prefix.
- Reach keys through the object: `useQuery(byokQueries.mine())`, `invalidateQueries({ queryKey: byokQueries.all() })`, `setQueryData(byokQueries.mine().queryKey, …)`.
- Keep the object next to the server functions it calls, in the feature's `.functions.ts`. Reference: [`-byok.functions.ts`](src/routes/_protected.settings/-byok.functions.ts).

`threadKeys` / `threadMutationKeys` / `topicKeys` / `authKeys` are the old shape and are being migrated. `threadKeys` groups sidebar queries under a thread namespace they do not belong to. Do not add entries to them. Write new queries in the shape above.

---

## Error handling

Never `try`/`catch`. Wrap fallible async work with `Result.tryPromise(...)` from `better-result`. Prefer the bare callback (`Result.tryPromise(async () => …)`) unless a kit needs a typed `catch` mapper. Consume with `match`, `mapError`, `tapError`, or `Result.isError` / `Result.isOk`.

Never render raw error messages in client UI. No `error.message`, provider payloads, stack traces, or other server-derived text. Show user-safe copy via GT or an error-code lookup ([`src/lib/errors/auth-error.ts`](src/lib/errors/auth-error.ts)). Log details server-side.

---

## Kit

`Kit` is the backend pattern for testable application logic. Use raw `Result.tryPromise(...)` for a simple fallible operation. Use `Kit.gen(...)` when application logic coordinates multiple kit operations or needs injectable dependencies.

Do not create a kit solely to wrap one SDK call used by one server function. Keep that call at its owning boundary with `Result.tryPromise(...)`.

### Naming

- Kit modules and their types keep the `*Kit` suffix: `dbKit`, `type DbKit`.
- `Kits<[...]>` is the combined context type.
- Live contexts and their aliases use `*Ctx`: `const byokCtx = Kit.createContext(dbKit)`, `type ByokCtx = Kits<[DbKit]>`.

`Kit.createContext(...)` belongs in the module that consumes the action (server function, workflow step, or tool) as an unexported `const`. Never export it. Exporting ships one caller's dependency choice to every other caller, defeats injection (tests pass their own context), and pulls live `dbKit` / `s3Kit` into any module that imports it. A `.server.ts` module exports its `Kit.gen` actions and its `Kits<[...]>` type. The consumer supplies the context.

### Modules

Kit files live under `src/lib/` and define named tuple modules with `Kit.define(name, value)`. The value exposes bare `Result.tryPromise`. Do not wrap with `Result.await` inside the kit.

- `db-kit.ts`: `run`, `transaction`
- `memory-kit.ts`: threads and messages over the store and vector
- `s3-kit.ts`: `deleteObject`, `deleteObjects`, `getObject`, …
- `vector-kit.ts`: `createIndex`, `deleteVectors`, `upsert`

Each kit exports a mockable `*Api`. Pass a `satisfies DbApi` (or `MemoryApi` / `S3Api` / `VectorApi`) object to `create*Kit` in tests.

The shared Drizzle client is exported as `drizzleDb` from `src/db/index.ts` because Better Auth needs the concrete client at init. Application queries still go through `dbKit`.

### Inside `Kit.gen`

Compose sequential kit results with `yield* await`. Return expected, recoverable tool outcomes as `Result.ok(...)`. Reserve `Err` for failures that should short-circuit.

Run independent Result promises concurrently with `yield* await Kit.promiseAll([...])`. It keeps `Promise.all` concurrency, combines successful values in input order, and unions member error types. Keep a bespoke loop when results must stay paired with source records or need per-item handling.

```ts
const [topics, threads] = yield* await Kit.promiseAll([
  ctx.db.run((db) => db.select(...)),
  ctx.memory.listThreads(...),
]);
```

When a `db.run` / `db.transaction` callback only returns one Drizzle query, use an implicit-return callback. No `async`, braces, or inner `await`:

```ts
yield *
  (await ctx.db.run((db) =>
    db.update(file).set({ status: "ready" }).where(eq(file.id, input.fileId)),
  ));
```

Use an `async` block only when the callback performs multiple awaited operations or must return a transformed value.

Use `result.match({ ok, err })` only when both branches need meaningful handling. If the success value passes through unchanged and only the error is mapped, use `if (Result.isError(result))` and `return result.value`. An `if (Result.isError(result))` is also right when TypeScript narrowing is needed, or when throwing must happen outside a Result callback to preserve the original error.

Use `mapError` to translate an error type and `tapError` for error-only side effects such as logging. Prefer those over an `if` that only maps or observes a branch.

At tool boundaries, keep provider and infrastructure details out of error output shown to the model.

### Kit errors

Tagged kit errors are a fixed domain `message` plus the original failure in `cause`. Do not copy `cause.message` (or provider/SDK text) into `message`.

Write the message inline at each call site, naming the operation that failed (`"Failed to delete the thread"`). No shared `toXError` helper with one generic message for the whole kit.

```ts
// Good. Stable Display naming the operation, cause kept for logs.
Result.tryPromise({
  try: async () => memory.deleteThread(id),
  catch: (cause) => new MemoryError({ cause, message: "Failed to delete the thread" }),
});

// Bad. Flattens the source into the wrapper.
new MemoryError({
  cause,
  message: cause instanceof Error ? cause.message : "Failed to delete the thread",
});

// Bad. One helper, one message for every operation.
const toMemoryError = (cause: unknown) =>
  new MemoryError({ cause, message: "Memory operation failed" });
```

Keep structured SDK metadata when useful (`code`, `requestId`, `statusCode` on `S3Error`). That is not the same as copying Display text.

Kits should not `throw` the same tagged error their catch maps to. Return `Result.err(...)` for domain failures, or let foreign exceptions hit the wrap handler. `s3Kit` is the exception: AWS response shapes force a few `throw new S3Error` paths, so `toS3Error` re-returns `S3Error.is`.

### `Kit.run` at the boundary

Use `Kit.run(async () => operationReturningResult())` only in thin server-function, workflow, or tool adapters that can directly return the successful value. Finish with `.throws()` to throw the original error, or `.throws<BoundaryError>(mapper)` to translate it.

Do not use `Kit.run` in ordinary application logic, middleware, client code, recovery paths, transformed-success handlers, or multi-step Result branching.

`inspect` / `inspectErr` are synchronous observation hooks before `.throws()`. They preserve the Result. If an inspection callback throws, Better Result panics.

Inline `Kit.run(...)` and return its `.throws()` promise. No redundant `await`. Do not use `.unwrap()` at a throwing boundary. It converts `Err` into `Panic`.

```ts
execute: async ({ inputData }) =>
  Kit.run(async () => processFn(processCtx, inputData)).throws(),
```

Bare `.throws()` does not sanitize errors for a client. At server-function boundaries, map the complete error union to user-safe `ServerFnError` values with `matchError(...)` inside `.throws<ServerFnError>(...)`. When the source union already includes `ServerFnError`, pass it through as another `matchError` key, not an `if (ServerFnError.is(error))` guard. The guard keeps working after the action stops returning `ServerFnError`. The key stops compiling.

```ts
.throws<ServerFnError>((error) =>
  matchError(error, {
    DatabaseError: () => toServerFnError.serverError("Failed to delete the API key"),
    ServerFnError: (error) => error,
  }),
),
```

Use `status: "unauthorized"` when mapping auth failures. Never forward `error.message` / `cause` from kit infra errors to the client. Domain errors that already carry intentional user-facing copy (for example `FileUploadError` by reason) are the exception at the boundary.

`ServerFnError` lives in `src/lib/errors/server-fn-error.ts`, built through `toServerFnError`. Shared helpers such as `toServerFnError.serverError(...)` only construct the mapped error. Keep the exhaustive map at the call site.

### `Kit.get` for a simple handler

Prefer `Kit.createContext(...)` with `Kit.gen` for application logic. Use `Kit.get(module)` only when wiring a full kit action would be more boilerplate than it is worth:

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

Reference: [`get-file-download-url.ts`](src/routes/_protected.topic.$topicId/-files-api/get-file-download-url.ts)

### File shape

A feature splits across two modules, per [Server and client](#server-and-client): [`.server.ts`](src/routes/_protected.settings/-byok.server.ts) holds the application logic, [`.functions.ts`](src/routes/_protected.settings/-byok.functions.ts) holds the `createServerFn` wrappers and the query options the client imports.

`*.server.ts`, in order:

1. Imports. External packages first, then app modules. Import kit types only (`type DbKit`, not `dbKit`). Live kits belong to the consumer.
2. Constants and pure helpers used by the actions.
3. The context type: `type ByokCtx = Kits<[DbKit]>`.
4. Internal input types, named after the use case (`CreateByokInput`).
5. Exported `Kit.gen(...)` actions, `ctx` first. Destructure input in the parameter list when it helps.

`*.functions.ts`, in order:

1. Imports, including the live kits and the actions from the `.server.ts` sibling.
2. The unexported live context: `const byokCtx = Kit.createContext(dbKit)`.
3. A shared boundary error mapper when several server functions map the same error union.
4. Exported result DTO types consumed by the route and client.
5. `createServerFn` definitions: `validator` schema inline, then `middleware`, then a handler that directly returns `Kit.run(async () => action(byokCtx, input)).throws<ServerFnError>(...)`.
6. The feature's `xQueries` object, next to the read server functions it wraps.

Action input types should contain already-normalized boundary values. Authenticated users arrive as `SafeId<"user">`. Route and search data is trimmed or defaulted at the server boundary before the kit action. Result DTOs are plain serializable shapes.

```ts
// search.server.ts. Exports the action, never the context.
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
// search.functions.ts. Owns the live context.
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

---

## Code organization

Do not export types, constants, functions, or components unless another module imports them.

Do not re-export symbols (`export { x } from "./y"`, `export * from`, or `import { x } from "./y"; export { x }`). Import from the module that defines the symbol so "go to definition" and searches land on the source. No barrel `index` files.

Do not create a new file unless the code is reused across modules, the existing file is already too large, or the user asks for one. A subagent tool name used only in [`tool-parts.ts`](src/lib/ai-sdk/tool-parts.ts) belongs as an inline constant there, not in a new `*.constants.ts`.

Keep non-JSX helpers as unexported locals inside the `.tsx` file. Do not export them "just in case," and do not preemptively create a `*-logic.ts` sibling. Prefer testing the component over extracting a tiny helper solely for a unit test. Only move a pure helper into `src/lib/` (or a co-located `-{name}-logic.ts` with the route-ignore `-` prefix) when it is reused across modules, or a focused pure-function test is clearly more valuable than a component test. Example: [`pagination.ts`](src/lib/pagination.ts).

`.tsx` files export components and types only. Vite's React plugin Fast Refresh expects that. Exporting a helper, a non-literal constant, or a hook from a `.tsx` module falls back to a full reload ([vite-plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#consistent-components-exports)). Put utilities in `.ts`. Type-only exports (`export type …`) may stay in `.tsx`.

---

## TanStack Router

Every file under `src/routes/` follows the same shape. `createFileRoute(...)({ component: ... })` runs before the component is defined, so the component must be a hoisted function declaration, not an arrow function.

Name the component `RouteComponent` for page routes and `LayoutComponent` for pathless layouts (`_*.tsx` / `_*/route.tsx`). Do not invent per-route names like `SignInRoute`.

```tsx
export const Route = createFileRoute("/some/path")({
  component: RouteComponent,
});

function RouteComponent() {
  // ...
}
```

Do not convert these to `const RouteComponent = () => {}`. The temporal dead zone breaks the route registration.

### Search param updates

When updating search params with a functional updater (`search: (prev) => …`), never spread `prev`. Use Immer `produce`:

```tsx
import { produce } from "immer";

void navigate({
  to: ".",
  search: (prev) =>
    produce(prev, (draft) => {
      draft.page = 1;
      draft.query = nextQuery;
    }),
});
```

TanStack Router's `search` option is typed loosely. Spreading `{ ...prev, query: nextQuery }` silently survives schema renames (`query` → `q`) and typos on keys you omit. Mutating through Immer's `draft` is checked against the inferred search type.

Prefer `Route.useNavigate()` / `Route.Link` (or `from={Route.fullPath}`) so `prev` is inferred from the route's `validateSearch` schema.

### Reading search params and path params

Always pass a `select` to `useSearch` and `useParams`. Without it the component subscribes to the whole object and re-renders when any unrelated field changes.

Read several fields with one call whose `select` returns an object, not one hook call per field. The router is created with `defaultStructuralSharing: true` ([render optimizations](https://tanstack.com/router/latest/docs/guide/render-optimizations#structural-sharing-with-fine-grained-selectors)), so a freshly built object with unchanged contents does not re-render. Selected data must stay JSON-compatible. TypeScript rejects class instances.

```tsx
// Good. One subscription, one object.
const { q, topic } = useSearch({
  from: "/_protected",
  select: (search) => ({ q: search.q, topic: search.topic }),
});
const topicId = Route.useParams({ select: (params) => params.topicId });

// Bad. Destructuring subscribes to everything.
const { q, topic } = useSearch({ from: "/_protected" });

// Bad. One hook per field.
const q = useSearch({ from: "/_protected", select: (search) => search.q });
const topic = useSearch({ from: "/_protected", select: (search) => search.topic });
```

`Register.router` uses `typeof router` on a module-level router instance (see [`src/router.tsx`](src/router.tsx)), not `ReturnType<typeof getRouter>`.

Reference: [`src/routes/_protected.topic.$topicId/files.tsx`](src/routes/_protected.topic.$topicId/files.tsx)

---

## Server and client

File suffixes mark which side of the network a module may be loaded on, following [TanStack Start's file organization](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions#file-organization).

| Suffix           | Contents                                                                  | Client-safe to import |
| ---------------- | ------------------------------------------------------------------------- | --------------------- |
| `.server.ts`     | Server-only code: DB queries, secrets, `node:` APIs, server `env`         | No                    |
| `.functions.ts`  | `createServerFn` wrappers, plus the query options and keys that call them | Yes                   |
| `.middleware.ts` | `createMiddleware` definitions                                            | Yes                   |
| `.ts` / `.tsx`   | Types, schemas, constants, hooks, components                              | Yes                   |

Do not use `-api` in file names. The suffix already says what the module is.

The Start compiler strips `.handler()` and `.server()` callback bodies from the client build, then dead-code-eliminates the imports only those bodies used. That is what keeps `@/db` out of the browser, and it only works if every server-only symbol is reachable solely from inside those callbacks. A server-only helper exported at the top level of a module the client imports survives DCE and drags the database module into the browser, where `env.DATABASE_URL` throws `Attempted to access a server-side environment variable on the client`.

A `.server.ts` module may only be imported from inside a server function handler, middleware `.server()` body, or another `.server.ts` module. Never from a component, hook, or the top level of a `.functions.ts` / `.middleware.ts` file.

This bites hardest with middleware. `.middleware([...])` is not stripped. The client keeps the reference to run its own middleware chain. A `.middleware.ts` file must contain nothing but the middleware itself. Any helper it needs at request time belongs in a `.server.ts` sibling that the `.server()` body imports. See [`provider-key.middleware.ts`](src/lib/middleware/provider-key.middleware.ts) and [`get-provider-key.server.ts`](src/lib/get-provider-key.server.ts).

Reference split: [`-byok.server.ts`](src/routes/_protected.settings/-byok.server.ts) and [`-byok.functions.ts`](src/routes/_protected.settings/-byok.functions.ts).

To check whether a module leaked into the client bundle, fetch its dev transform and look at the surviving imports:

```sh
curl -s http://localhost:3000/src/lib/middleware/provider-key.middleware.ts
```

`src/db/` and `src/mastra/` are server-only by directory. Files there are being migrated to the suffix incrementally.

---

## Valibot

Use Valibot for every input boundary: server fn validators, middleware `validator`, route `validateSearch`, env vars, tool/workflow schemas, and form `onDynamic` schemas.

Mastra workflow lifecycle callbacks receive initial data that has already passed the workflow `inputSchema`. Use `v.parse(workflowInputSchema, getInitData())` directly to recover the inferred type. Do not wrap it in a Result or add a `safeParse` branch for a shape Mastra already validated.

### Tool input descriptions

For Mastra `createTool` input schemas, document each parameter with `v.description(...)` in the pipe (after constraints). Put defaults, formats, and where to get IDs there, not in the tool-level `description` string. The tool description owns purpose, when to use / not use, outputs, and fallbacks. See [`.agents/change-tool-description/SKILL.md`](.agents/change-tool-description/SKILL.md).

### Pipe constraints

Always compose base types and refinements with `v.pipe`. Do not use bare action schemas (`v.nonEmpty()`, `v.minLength()`, `v.integer()`, `v.nanoid()`) without a preceding base type.

```tsx
// Good
title: v.pipe(v.string(), v.nonEmpty()),
page: v.pipe(v.number(), v.integer(), v.minValue(1)),
sha256: v.pipe(v.string(), v.length(64)),

// Bad
title: v.nonEmpty(),
page: v.integer(),
id: v.string(),
```

For optional fields, wrap the full pipe: `v.optional(v.pipe(v.string(), v.nonEmpty()), defaultValue)`.

### ID fields

Any schema field named `id` or ending in `Id` (`topicId`, `threadId`, `fileId`, `userId`, `messageId`, …) must validate as a nanoid:

```tsx
topicId: v.pipe(v.string(), v.nanoid()),
messageId: v.optional(v.pipe(v.string(), v.nanoid())),
```

---

## Forms

TanStack React Form for validation and state, field primitives in [`@/components/ui/field`](src/components/ui/field.tsx) for rendering. This pattern for every form.

### Building a form

Schema with Valibot inside the component, using `useGT()` for localized error copy:

```tsx
const gt = useGT();

const schema = v.object({
  email: v.pipe(
    v.string(),
    v.nonEmpty(gt("This field is required.")),
    v.email(gt("Please enter a valid email address.")),
  ),
});
```

Inline literal constraints (`v.minLength(8, ...)`). Do not extract magic-number constants like `MIN_PASSWORD_LENGTH`.

`useForm` with `defaultValues` and a single `onDynamic` validator. `onDynamic` adapts to field state: blur/submit before the field is touched, then every change after.

`validationLogic: revalidateLogic()` from `@tanstack/react-form` is required when the form-level schema lives only in `onDynamic`. TanStack's default logic runs `onChange` / `onBlur` / `onSubmit` on submit. It does not include `onDynamic`, so without `revalidateLogic()` submit would skip the schema.

```tsx
const form = useForm({
  defaultValues: { email: "", password: "" },
  onSubmit: async ({ value }) => {
    /* ... */
  },
  validationLogic: revalidateLogic(),
  validators: { onDynamic: schema },
});
```

Locate the schema inside the component so `useGT()` stays aligned with the active locale.

### Rendering validation errors

Errors are read off each field, not collected into a form-level map. Hand the TanStack field to both [`Field`](src/components/ui/field.tsx) and [`FieldError`](src/components/field-error.tsx):

```tsx
<form.Field name="key">
  {(field) => (
    <Field field={field}>
      <FieldLabel htmlFor={field.name}>
        <T>API key</T>
      </FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => {
          field.handleChange(event.target.value);
        }}
        value={field.state.value}
      />
      <FieldError field={field} />
    </Field>
  )}
</form.Field>
```

`Field` derives `data-invalid` from `isTouched && !isValid`, which turns the label and border destructive.

`FieldError` renders nothing until the field is touched and invalid, then passes `field.state.meta.errors` down. Messages are deduplicated. Multiple errors become a bulleted list. Do not read `meta.errors` or join messages by hand.

Set `id={field.name}` on the control and `htmlFor={field.name}` on the label.

Reference: [`-provider-key-form.tsx`](src/routes/_protected.settings/-provider-key-form.tsx).

### Submit button state

Subscribe narrowly:

```tsx
<form.Subscribe
  selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
>
  {({ canSubmit, isSubmitting }) => (
    <Button disabled={!canSubmit || isSubmitting} type="submit">
      <T>Add key</T>
    </Button>
  )}
</form.Subscribe>
```

Subscribe to `canSubmit` alone when the form has no async submit to guard against.

### API errors vs validation errors

- Validation errors (client-side, from the schema) go through `<FieldError field={field} />`.
- Generic API errors (for example Better Auth) go through `toast.error(...)` from `sonner`, via the error-code lookup in [Error handling](#error-handling).
- Error toasts are title-only by default. Add a `description` only when it carries a real explanation, such as the translated cause from an auth error-code lookup. Never pad a toast with "Please try again."

```tsx
toast.error(gt("Something went wrong"), {
  description: getAuthErrorDescription(gt, code),
});
```

### Submit handler

Plain `<form>`. `preventDefault` + `stopPropagation`, then `await form.handleSubmit()` as in [Async](#async).

### Reference implementations

- [`src/routes/_protected.settings/-provider-key-form.tsx`](src/routes/_protected.settings/-provider-key-form.tsx)
- [`src/routes/_auth/sign-up.tsx`](src/routes/_auth/sign-up.tsx)

---

## AI SDK tool parts

Helpers for rendering AI SDK v6 `UIMessage` tool parts live in [`src/lib/ai-sdk/tool-parts.ts`](src/lib/ai-sdk/tool-parts.ts).

- `getToolPartStatus` maps a tool part's `state` to `pending` | `done` | `error`. Reuse it instead of duplicating the switch in components.
- `isVisibleToolPart` is whether a tool name renders visible UI during streaming. Use it in streaming placeholder checks.
- Mastra supervisor `agents: { webSearch }` becomes `agent-webSearch`. Add subagent tool-name constants inline in `tool-parts.ts`.

When adding a new subagent with custom UI, add its `agent-<key>` name to `tool-parts.ts` and extend `isVisibleToolPart`.

---

## Internationalization

Use GT with `gt-tanstack-start` throughout the app. Import `useGT`, `useLocale`, and `useSetLocale` from `gt-tanstack-start`. Use `<T>text</T>` from `gt-react` or `gt-tanstack-start` for simple visible JSX text, and `const gt = useGT()` for attributes, toasts, validators, tooltips, and interpolated or conditional copy. Helpers outside components that need translations take `gt: GT` from [`src/lib/gt.ts`](src/lib/gt.ts).

Supported locales are English (`en`) and Polish (`pl`). The active locale is stored in the GT locale cookie. Use `useLocale()` and `useSetLocale()` for client-side locale controls.

GT translation artifacts live in [`src/_gt/`](src/_gt/). Keep source strings inline in English. Run `nub run translate` (`gt generate`) to refresh hash-keyed templates in `src/_gt/` (no API key). Translate `src/_gt/pl.json` values to Polish yourself. Do not use `gt translate` / the GT cloud API.

Reuse the same English source string for shared UI words ("Cancel", "Delete", "Search") instead of inventing near-duplicate copy.

---

## Database and Temporal

Model a state that flips at a point in time as a nullable timestamp (`activatedAt`, `finishedAt`, `verifiedAt`), not a boolean (`active`, `finished`, `verified`). `IS NOT NULL` gives the same predicate and index, and the column also records when it happened.

Always use `Temporal` (`Temporal.Instant`, `Temporal.Now.instant()`, `Temporal.PlainDate`) instead of `Date`, `Date.now()`, and `Date.parse`, on the server and in client UI. `Date` is mutable, parses ambiguously, and has no duration arithmetic.

`Temporal` is a bare global. Never import it. `src/router.tsx` loads `temporal-polyfill/global` behind a `!globalThis.Temporal` guard for Safari. Every other target uses the native implementation. Delete the guard and the dependency once Safari ships.

The one exception is a library whose API takes a `Date`: Drizzle `$onUpdate` and query predicates, Mastra `createdAt`/`updatedAt`, Better Auth. Pass `new Date()` there directly.

Do not add shared Date↔Temporal conversion helpers. At a `Date` boundary use the built-ins inline: `date.toTemporalInstant()` going in, `new Date(instant.epochMilliseconds)` going out.

`Intl.DateTimeFormat.prototype.format` accepts Temporal objects directly. Do not round-trip through `Date` to format one.

---

## SafeId

Branded backend IDs. Nouns: [`CONTEXT.md`](CONTEXT.md). Implementation: `src/lib/safe-id.ts`, `src/db/schema.ts`.

Server functions still accept raw strings. Validators stay as `v.pipe(v.string(), v.nanoid())`. After validation, brand IDs only when they are about to touch a branded backend surface, usually a Drizzle column.

Use `toSafeId` for raw IDs that have already crossed a trusted boundary:

```ts
// oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
id: toSafeId<"topic">(data.topicId),
userId: context.user.id,
```

Keep the comment short and specific. Good reasons: `paired with userId check.`, `trusted auth session.`, `trusted server context.`, `server-generated ID.`, `scoped by trusted topic.`

When branding an ID before checking ownership, the comment should say that ownership is being checked. When branding an ID from context, the comment should say the context is trusted.

Do not destructure an input field only to pass it into `toSafeId`. Write `toSafeId(inputData.fileId)` so the trust boundary stays visible.

Use `createSafeId` for app-owned IDs created on the backend. Do not call `toSafeId(nanoid())`.

```ts
const topicId = createSafeId<"topic">();
```

Frontend and DTOs use raw strings. If a selected Drizzle ID would leak a brand into React, query keys, route params, or client-facing data, convert it with `rawId`. Only use `rawId` when TypeScript shows that a branded ID is crossing into a raw-string surface.

```ts
return {
  id: rawId(row.id),
};
```

Mastra request context is set by server code before agent, tool, or workflow execution. Keep JSON schemas as raw nanoid strings, then brand request-context values when they are used with branded Drizzle columns. If a tool uses a file ID from tool input together with a trusted topic ID from request context, brand the file ID only for that scoped lookup.

Do not:

- Use branded IDs on the frontend.
- Change server function inputs from `v.string()` nanoids to branded types.
- Brand Better Auth schema columns.
- Silence `toSafeId` without a short reason.

Mastra thread scope uses `thread.resourceId` and memory APIs use `resource` / `resourceId`. Those are Mastra identifiers, not uploaded-file IDs.
