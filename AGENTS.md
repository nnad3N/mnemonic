# Code Standards

This project uses **Oxlint** and **Oxfmt** for linting and formatting.

## Quick Reference

- **Format code**: `nub run format`
- **Lint and autofix**: `nub run lint`
- **Format and lint**: `nub run fix`
- **Typecheck only**: `nub run typecheck`
- **Run tests**: `nub run test` (includes Vitest typecheck)

Oxlint + Oxfmt provide robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

Architecture notes for agents live in [`.agents/architecture`](.agents/architecture). Read the relevant note before changing a documented cross-cutting pattern, such as branded backend IDs.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names
- When branding, validating, or otherwise narrowing a property from a structured input object, pass the property directly from its source object (e.g. `toSafeId(inputData.fileId)`) instead of destructuring it first solely to pass into the narrowing helper. Keep the original trust boundary visible at the call site.

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer `.at(index)` over bracket indexing (`array[index]`) unless you have already verified the index exists (e.g. after a bounds check or when iterating with a known-valid index)
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`
- Bare early returns without braces are only for empty returns — literally `return;`: `if (condition) return;`. Always use curly braces when returning a value: `if (condition) { return value; }`

### Async & Promises

- Always consume promises in async functions. When directly returning a promise, return it without a redundant `await`; otherwise `await` it and use the result.
- Use `async/await` syntax instead of promise chains for better readability
- Don't use async functions as Promise executors
- **Do not overuse the `void` operator.** It is not a way to silence an unhandled-promise warning. `void` is only correct in two cases: the callback's signature is fixed as synchronous by a library and cannot be made `async`, or the call is genuinely fire-and-forget and nothing should wait on it. Everywhere else, `await`.
- In particular, event handlers can be `async` — make them so and `await` the promise. `void form.handleSubmit()` is wrong, because `onSubmit={async (event) => { …; await form.handleSubmit(); }}` costs nothing and keeps the result available to sequence against.

### React & JSX

- Use function components over class components
- Prefer arrow function components; use implicit return (`() => (...)`) when the body is only JSX — do not wrap a single JSX return in `{ return ...; }`
- Components that call hooks use a block body; the JSX return after hooks is fine
- Define a named `ComponentNameProps` type for each component's props — do not inline prop object types in the parameter list
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles
  - Do not add `aria-label` or `title` attributes
- **Variant styling** — do not add helper functions that map a discriminant to Tailwind class strings (e.g. `getStatusClassName(status)` with a `switch`). Either inline classes in JSX with `cn(..., condition && "class")`, or extract a small component that owns the variant markup:
- Keep static Tailwind class strings inline in JSX unless extracting a small component or using `cn(...)` materially improves conditional readability. Do not create local constants whose only purpose is to hold a reusable Tailwind class string for one file.

```tsx
// Good — inline
<span
  className={cn(
    "size-1.5 rounded-full",
    status === "ready" && "bg-green-500",
    status === "failed" && "bg-red-500",
  )}
/>;

// Good — component owns the variants
const FileStatusChip = ({ status }: { status: FileStatus }) => (
  <Badge variant="outline">
    <span
      className={cn(
        "size-1.5 rounded-full",
        status === "ready" && "bg-green-500",
        status === "failed" && "bg-red-500",
      )}
    />
    {label}
  </Badge>
);

// Bad — class-string lookup helper
const getStatusDotClassName = (status: FileStatus) => {
  switch (status) {
    case "ready":
      return "bg-green-500";
    // ...
  }
};
```

### TanStack Query

- Define reusable `queryOptions(...)` / `infiniteQueryOptions(...)` builders for queries, and pass those option objects to `useQuery` / `useInfiniteQuery`.
- Do not pass explicit generics to `useQuery`, `useInfiniteQuery`, `queryOptions`, or `infiniteQueryOptions`. Let TypeScript infer the types from the query function and options.
- Do not pass explicit generics to `queryClient.setQueryData`. Use the query options' `queryKey` so TypeScript can infer the cached data shape.
- When updating query data, prefer Immer `produce` for nested updates instead of spread-heavy object reconstruction.
- Do not destructure and rename several fields from `useQuery` / `useInfiniteQuery` results. Keep the query result object intact, but do not add a `Query` suffix just because it came from a query hook. Use the domain noun, e.g. `const threads = useInfiniteQuery(...)`, then read `threads.data`, `threads.fetchNextPage`, `threads.isFetchingNextPage`, etc.
- If a component only needs `data` from a query hook, destructure that one field and name it after the domain value, e.g. `const { data: topicId } = useSuspenseQuery(...)`.

#### Query keys live inside their query options

Follow [TkDodo's Query Options API](https://tkdodo.eu/blog/the-query-options-api): a feature exports **one `xQueries` object** that holds both the key hierarchy and the fetching, and there is no standalone key factory to keep in sync with it.

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

- Every entry is a **function**, including `all`. A property evaluated eagerly cannot reference `byokQueries` while the object is still being constructed.
- Leaf entries return `queryOptions(...)`; grouping entries (`all`, and any intermediate level) return a bare key array used only as an invalidation prefix.
- Reach keys through the object — `useQuery(byokQueries.mine())`, `invalidateQueries({ queryKey: byokQueries.all() })`, `setQueryData(byokQueries.mine().queryKey, …)`. Do not export a separate `xKeys` const.
- Keep the object next to the server functions it calls, in the feature's `.functions.ts`, and put it at the **top of the file**, above the server functions themselves — the same goes for any mutation option objects. A reader opening the module sees what the feature exposes to components before the handler bodies. `queryFn` closures are evaluated on call, so referencing a server function declared further down is fine. Reference implementation: [`-byok.functions.ts`](src/routes/_protected.settings/-byok.functions.ts).

`threadKeys` / `threadMutationKeys` / `topicKeys` / `authKeys` are the old shape and are being migrated; `threadKeys` in particular groups sidebar queries under a thread namespace they don't belong to. Don't add entries to them — write new queries in the shape above.

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- **Never use `try`/`catch`** — wrap fallible async work with `Result.tryPromise(...)` from `better-result`. Prefer the bare callback form (`Result.tryPromise(async () => …)`) unless a kit needs a typed `catch` mapper. Consume results with `match`, `mapError`, `tapError`, or `Result.isError(...)` / `Result.isOk(...)` according to the operation; do not use `try`/`catch` to swallow, rethrow, or translate errors.
- Prefer early returns over nested conditionals for error cases
- **Never render raw error messages in client UI** — do not display `error.message`, provider/API payloads, stack traces, or other server-derived text. Show user-safe copy via GT translations or an error-code lookup (see [`src/lib/errors/auth-error.ts`](src/lib/errors/auth-error.ts)); log details server-side for debugging
- **Kit infra errors** — fixed domain `message` + `cause`; never copy `cause.message` into the wrapper. See [`.agents/architecture/kit-services.md`](.agents/architecture/kit-services.md) (Kit errors).
- **One message per failure site** — construct the tagged error inline in each `catch` with a message naming the operation that failed (`"Failed to delete the thread"`), not through a shared `toXError` helper with one generic message for the whole kit. A generic `"Memory operation failed"` tells a log reader nothing about which call failed.

### Better Result and Kit patterns

- Use raw `Result.tryPromise(...)` for a simple fallible operation. Use `Kit.gen(...)` when application logic coordinates multiple kit operations or needs injectable dependencies.
- **Never export a kit context.** `Kit.createContext(...)` belongs in the module that consumes the `Kit.gen` action — the server function, workflow step, or tool — as an unexported `const`. Exporting a context ships one caller's dependency choice to every other caller, defeats the injection the kit exists for (tests pass their own context), and drags the live `dbKit` / `s3Kit` imports into any module that imports it. A `.server.ts` module exports its `Kit.gen` actions and its `Kits<[...]>` type; the consumer supplies the context.
- Inside `Kit.gen`, compose asynchronous kit results with `yield* await`. Return expected, recoverable tool outcomes as ordinary `Result.ok(...)` values; reserve `Err` for failures that should short-circuit the action.
- Inside `Kit.gen`, use `yield* await Kit.promiseAll([...])` when independent operations return Result promises and should run concurrently. It preserves Promise.all concurrency, combines successful values in input order, and unions member error types. Keep bespoke loops when results must remain paired with source records or need per-item handling.
- Use `result.match({ ok, err })` only when both branches need meaningful handling. Outside thin `Kit.run` boundary adapters, if the success value passes through unchanged and only the error branch is mapped, use a normal `if (Result.isError(result))` followed by `return result.value`. At tool boundaries, keep provider and infrastructure details out of error output shown to the model.
- Use `mapError` to translate an error type and `tapError` for error-only side effects such as logging. Prefer these combinators over an `if` that only maps or observes a Result branch.
- Use `Kit.run(async () => operationReturningResult())` only in thin server-function, workflow, or tool adapters that can directly return the successful value. Finish the chain with `.throws()` to throw the original error instance, or `.throws<BoundaryError>(mapper)` to translate it. Do not use `Kit.run` in ordinary application logic, middleware, client code, recovery paths, transformed-success handlers, or multi-step Result branching.
- `Kit.run(...).inspect(...)` and `.inspectErr(...)` provide synchronous success/error side effects before `.throws()`. They preserve the underlying Result and use Better Result's Panic behavior if an inspection callback throws.
- At server-function boundaries, map the complete error union to user-safe `ServerFnError` values with Better Result's `matchError(...)` inside `.throws<ServerFnError>(...)`. When the source union already includes `ServerFnError`, pass it through as **another `matchError` key** — `ServerFnError: (error) => error` — not with an `if (ServerFnError.is(error))` guard ahead of the match. The guard silently keeps working after the action stops returning `ServerFnError`; the key stops compiling, which is the signal you want:

```ts
.throws<ServerFnError>((error) =>
  matchError(error, {
    DatabaseError: () => toServerFnError.serverError("Failed to delete the API key"),
    ServerFnError: (error) => error,
  }),
),
```

- Inline `Kit.run(...)` in the framework adapter and directly return its `.throws()` promise without a redundant `await`. Do not use Better Result's `.unwrap()` at a throwing boundary because it converts `Err` into `Panic`:

```ts
execute: async ({ inputData }) =>
  Kit.run(async () => processFn(processCtx, inputData)).throws(),
```

- An `if (Result.isError(result))` remains appropriate when TypeScript narrowing is needed or when throwing must happen outside a Result callback to preserve the original error.
- When a `db.run` / `db.transaction` callback only returns one Drizzle query, use an implicit-return callback without `async`, braces, or an inner `await`:

```ts
yield *
  (await ctx.db.run((db) =>
    db.update(file).set({ status: "ready" }).where(eq(file.id, input.fileId)),
  ));
```

Use an `async` block body only when the callback performs multiple awaited operations or must explicitly return a transformed value.

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns
- Do not export types, constants, functions, or components unless another module needs to import them. Keep module-local implementation details unexported.
- Do not re-export symbols from other modules (`export { x } from "./y"`, `export * from`, or `import { x } from "./y"; export { x }`). Import from the module that defines the symbol so “go to definition” and searches land on the source.
- **Do not create new files unless necessary** — prefer editing an existing module when the change fits there (a local `const`, a helper in the same file, an export on an existing module). Only add a file when the code is reused across modules, the existing file is already too large, or the user explicitly asks for a new file. Example: a subagent tool name used only in [`tool-parts.ts`](src/lib/ai-sdk/tool-parts.ts) belongs as an inline constant in that file, not in a new `*.constants.ts`.
- **Component helpers stay private by default** — keep non-JSX helpers (`const getVisiblePageNumbers`, …) as unexported locals inside the `.tsx` file. Do **not** export them “just in case,” and do **not** preemptively create a `*-logic.ts` sibling. Prefer testing the component (or a real editor/DOM harness) over extracting tiny branch helpers solely for unit tests. Only when a pure helper is reused across modules, or a focused pure-function test is clearly more valuable than a component test: move it into a shared module under `src/lib/` (or a co-located `-{name}-logic.ts` with the TanStack route-ignore `-` prefix when it stays route-local), export it from there, and import it from the component and the test. Example: [`pagination.ts`](src/lib/pagination.ts) used by [`files.tsx`](src/routes/_protected.topic.$topicId/files.tsx).
- **`.tsx` exports are components (and types) only** — Vite’s React plugin Fast Refresh expects files to export React components. Exporting a non-component value (helpers, constants that aren’t simple literals Vite can treat as stable, hooks, etc.) from a `.tsx` module marks the refresh boundary incompatible and falls back to a full reload ([vite-plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#consistent-components-exports)). Keep utilities in `.ts` modules; keep type-only exports (`export type …`) in `.tsx` when needed.

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)

### React 19+

- Use ref as a prop instead of `React.forwardRef`

---

## TanStack Router file routes

Every file under `src/routes/` follows the same shape. `createFileRoute(...)({ component: ... })` runs **before** the component is defined, so the component must be a **hoisted function declaration**, not an arrow function expression.

- Name the component **`RouteComponent`** for page routes and **`LayoutComponent`** for pathless layouts (`_*.tsx` / `_*/route.tsx`). Don't invent per-route names like `SignInRoute` or `AuthLayout` — keep the name uniform across files so jumping between routes is predictable.
- Reference the component by name inside `createFileRoute`:

```tsx
export const Route = createFileRoute("/some/path")({
  component: RouteComponent,
});

function RouteComponent() {
  // ...
}
```

- Do **not** convert these to `const RouteComponent = () => {}` — the resulting temporal dead zone breaks the route registration.

### Search param updates (`navigate` / `Link`)

When updating search params with a functional updater (`search: (prev) => …`), **never spread `prev`**. Use Immer `produce` instead:

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

TanStack Router's `search` option is typed loosely — you can return almost any object and TypeScript will not complain. Spreading `{ ...prev, query: nextQuery }` silently survives schema renames (e.g. `query` → `q`) and typos on keys you omit. Mutating through Immer's `draft` is checked against the inferred search type, so renames and removed fields surface as type errors.

- Prefer **`Route.useNavigate()`** / **`Route.Link`** (or `from={Route.fullPath}`) so `prev` is inferred from the route's `validateSearch` schema.

### Reading search params and path params

Always pass a **`select`** to `useSearch` and `useParams`. Without it the component subscribes to the whole search/params object and re-renders whenever any unrelated field changes — a topic switch would re-render a component that only reads `page`.

Read several fields with **one call whose `select` returns an object**, not one hook call per field. The router is created with `defaultStructuralSharing: true` ([render optimizations](https://tanstack.com/router/latest/docs/guide/render-optimizations#structural-sharing-with-fine-grained-selectors)), so a freshly built object with unchanged contents is compared structurally and does not re-render. Selected data must stay JSON-compatible; TypeScript rejects class instances.

```tsx
// Good — one subscription, one object
const { q, topic } = useSearch({
  from: "/_protected",
  select: (search) => ({ q: search.q, topic: search.topic }),
});
const topicId = Route.useParams({ select: (params) => params.topicId });

// Bad — destructuring subscribes to everything
const { q, topic } = useSearch({ from: "/_protected" });

// Bad — one hook per field
const q = useSearch({ from: "/_protected", select: (search) => search.q });
const topic = useSearch({ from: "/_protected", select: (search) => search.topic });
```

- Ensure **`Register.router`** uses `typeof router` on a module-level router instance (see [`src/router.tsx`](src/router.tsx)) — not `ReturnType<typeof getRouter>`.

Reference: [`src/routes/_protected.topic.$topicId/files.tsx`](src/routes/_protected.topic.$topicId/files.tsx)

---

## Server/client module boundaries

File suffixes mark which side of the network a module may be loaded on, following [TanStack Start's file organization guidance](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions#file-organization).

| Suffix           | Contents                                                                           | Client-safe to import |
| ---------------- | ---------------------------------------------------------------------------------- | --------------------- |
| `.server.ts`     | Server-only code: DB queries, secrets, `node:` APIs, anything reading server `env` | **No**                |
| `.functions.ts`  | `createServerFn` wrappers, plus the query options and keys that call them          | Yes                   |
| `.middleware.ts` | `createMiddleware` definitions                                                     | Yes                   |
| `.ts` / `.tsx`   | Types, schemas, constants, hooks, components                                       | Yes                   |

Do not use `-api` in file names; the suffix already says what the module is.

**Why `.server.ts` matters.** The Start compiler strips `.handler()` and `.server()` callback bodies from the client build and then dead-code-eliminates the imports only those bodies used. That elimination is what keeps `@/db` out of the browser — and it only works if every server-only symbol is reachable _solely_ from inside those callbacks. A server-only helper exported at the top level of a module the client imports survives DCE and drags the whole database module into the browser, where `env.DATABASE_URL` throws `Attempted to access a server-side environment variable on the client`.

The rule that follows: **a `.server.ts` module may only be imported from inside a server function handler, middleware `.server()` body, or another `.server.ts` module.** Never from a component, hook, or the top level of a `.functions.ts`/`.middleware.ts` file.

This bites hardest with middleware, because `.middleware([...])` is _not_ stripped — the client keeps the reference to run its own middleware chain. So a `.middleware.ts` file must contain nothing but the middleware itself; any helper it needs at request time belongs in a `.server.ts` sibling that the `.server()` body imports. See [`provider-key.middleware.ts`](src/lib/middleware/provider-key.middleware.ts) and [`get-provider-key.server.ts`](src/lib/get-provider-key.server.ts).

Reference split: [`-byok.server.ts`](src/routes/_protected.settings/-byok.server.ts) (DB + encryption) and [`-byok.functions.ts`](src/routes/_protected.settings/-byok.functions.ts) (server fns + query options).

To check whether a module leaked into the client bundle, fetch its dev transform and look at the surviving imports:

```sh
curl -s http://localhost:3000/src/lib/middleware/provider-key.middleware.ts
```

`src/db/` and `src/mastra/` are server-only by directory; files there are being migrated to the suffix incrementally.

---

## Valibot schemas

Use Valibot for every input boundary: server fn validators, middleware `validator`, route `validateSearch`, env vars, tool/workflow schemas, and form `onDynamic` schemas.

Mastra workflow lifecycle callbacks receive initial data that has already passed the workflow `inputSchema`. Use `v.parse(workflowInputSchema, getInitData())` directly to recover the inferred type; do not wrap it in a Result or add a `safeParse` branch for a shape Mastra already validated.

### Tool input descriptions

For Mastra `createTool` input schemas, document each parameter with `v.description(...)` in the pipe (after constraints). Put defaults, formats, and where to get IDs there — not in the tool-level `description` string. The tool description owns purpose, when to use / not use, outputs, and fallbacks. See [`.agents/change-tool-description/SKILL.md`](.agents/change-tool-description/SKILL.md).

### Pipe constraints

Always compose base types and refinements with **`v.pipe`**. Do not use bare action schemas (`v.nonEmpty()`, `v.minLength()`, `v.integer()`, `v.nanoid()`, etc.) without a preceding base type in the pipe.

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

Reference: [`src/routes/_protected.topic.$topicId/-files-api/list-files.ts`](src/routes/_protected.topic.$topicId/-files-api/list-files.ts), [`src/lib/middleware/assert-thread-access.ts`](src/lib/middleware/assert-thread-access.ts)

---

## Forms

This project pairs **TanStack React Form** (validation/state) with the field primitives in [`@/components/ui/field`](src/components/ui/field.tsx) for the rendering layer. Follow this pattern for every form.

### Building a form

- **Schema with Valibot** inside the component, using `useGT()` for localized error copy:

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

- **Inline literal constraints** (e.g. `v.minLength(8, ...)`) — do not extract magic-number constants like `MIN_PASSWORD_LENGTH`.
- **`useForm`** with `defaultValues` and a single **`onDynamic`** validator. `onDynamic` adapts to field state: validates on blur/submit before the field is touched, then on every change after — one validator slot, no duplication.
- **`validationLogic: revalidateLogic()`** from `@tanstack/react-form` is **required** when the form-level schema lives only in `onDynamic`. TanStack's default validation logic runs `onChange` / `onBlur` / `onSubmit` on submit — it does **not** include `onDynamic`, so without `revalidateLogic()` submit would skip the schema and `onSubmit` could run with invalid data.

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

- **Locate the schema inside the component** so `useGT()` stays aligned with the active locale.

### Rendering validation errors

Errors are read off each field, not collected into a form-level map. Hand the TanStack field to both [`Field`](src/components/ui/field.tsx) and [`FieldError`](src/components/field-error.tsx) and they take care of the rest:

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

- `Field` derives `data-invalid` from `isTouched && !isValid`, which is what turns the label and border destructive.
- `FieldError` renders nothing until the field is touched **and** invalid, then passes `field.state.meta.errors` down — messages are deduplicated, and multiple errors become a bulleted list. Do not read `meta.errors` or join messages by hand.
- Set `id={field.name}` on the control and `htmlFor={field.name}` on the label so the two are associated.

Reference implementation: [`-provider-key-form.tsx`](src/routes/_protected.settings/-provider-key-form.tsx).

### Submit button state

Subscribe narrowly to drive the submit button:

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

- **Validation errors** (client-side, from the schema) → `<FieldError field={field} />` via the flow above.
- **Generic API errors** (e.g. Better Auth) → `toast.error(...)` from `sonner`. Translate via an error-code lookup (see [`src/lib/errors/auth-error.ts`](src/lib/errors/auth-error.ts)); never display raw provider messages.
- **Toast descriptions** — error toasts are title-only by default. Add a `description` only when it carries a real explanation of the error, such as the translated cause from an auth error-code lookup. Never pad a toast with filler like "Please try again."

```tsx
toast.error(gt("Something went wrong"), {
  description: getAuthErrorDescription(gt, code),
});
```

### Submit handler shape

Render a plain `<form>`; `preventDefault` + `stopPropagation` and forward to TanStack:

```tsx
<form
  className="flex flex-col gap-4"
  onSubmit={async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await form.handleSubmit();
  }}
>
```

### Reference implementations

- [`src/routes/_protected.settings/-provider-key-form.tsx`](src/routes/_protected.settings/-provider-key-form.tsx)
- [`src/routes/_auth/sign-up.tsx`](src/routes/_auth/sign-up.tsx)

---

## AI SDK UI tool parts

Helpers for rendering AI SDK v6 `UIMessage` tool parts live in [`src/lib/ai-sdk/tool-parts.ts`](src/lib/ai-sdk/tool-parts.ts).

- **`getToolPartStatus`** — maps a tool part's `state` to `pending` | `done` | `error`. Reuse this instead of duplicating switch logic in components.
- **`isVisibleToolPart`** — whether a tool name renders visible UI during streaming (meta-line labels plus custom delegation cards). Use this in streaming placeholder checks.
- **Subagent stream tool names** — Mastra supervisor `agents: { webSearch }` becomes `agent-webSearch`. Add subagent tool-name constants inline in [`tool-parts.ts`](src/lib/ai-sdk/tool-parts.ts).

When adding a new subagent with custom UI, add its `agent-<key>` name to `tool-parts.ts` and extend `isVisibleToolPart`.

---

## Internationalization (GT)

Use GT with `gt-tanstack-start` throughout the app. Import `useGT`, `useLocale`, and `useSetLocale` from `gt-tanstack-start`; it re-exports the GT React bindings used by the CLI scanner. Use `<T>text</T>` from `gt-react` or `gt-tanstack-start` for simple visible JSX text, and `const gt = useGT()` for attributes, toasts, validators, tooltips, and interpolated or conditional copy. Helpers outside components that need translations should take `gt: GT` from [`src/lib/gt.ts`](src/lib/gt.ts).

- Supported locales are English (`en`) and Polish (`pl`). The active locale is stored in the GT locale cookie; use `useLocale()` and `useSetLocale()` for client-side locale controls.
- GT translation artifacts live in [`src/_gt/`](src/_gt/). Keep source strings inline in English. Run `nub run translate` (`gt generate`) to refresh hash-keyed templates in `src/_gt/` (no API key). Translate `src/_gt/pl.json` values to Polish yourself — do not use `gt translate` / the GT cloud API.
- Reuse the same English source string for shared UI words (“Cancel”, “Delete”, “Search”, …) instead of inventing near-duplicate copy.

---

## Database schema

- **Never name a variable `row` or `rows`.** A query result takes the name of what it holds — `note`, `latestVersion`, `topics`. `row` forces the reader to scroll back to the query to learn what they are looking at, and it reads identically in every function, so nothing in a diff tells you which table is involved. Reach for a `Row` suffix (`noteRow`) **only** when the domain noun is already taken in that scope, such as a function that also writes through the imported `note` table.
- **Dates over booleans.** Model a state that flips at a point in time as a nullable timestamp (`activatedAt`, `finishedAt`, `verifiedAt`), not a boolean (`active`, `finished`, `verified`). `IS NOT NULL` gives the same predicate and index, and the column also records _when_ it happened, which a boolean throws away.

## Dates (Temporal)

- **Always use `Temporal`** — `Temporal.Instant`, `Temporal.Now.instant()`, `Temporal.PlainDate` — instead of `Date`, `Date.now()` and `Date.parse`, on the server **and** in client UI. `Date` is mutable, parses ambiguously, and has no duration arithmetic.
- `Temporal` is a bare global; never import it. `src/router.tsx` loads `temporal-polyfill/global` behind a `!globalThis.Temporal` guard for Safari, which has no stable support yet; every other target uses the native implementation. Delete the guard and the dependency once Safari ships.
- **The one exception is a library whose API takes a `Date`** — Drizzle `$onUpdate` and query predicates, Mastra `createdAt`/`updatedAt`, Better Auth. Pass `new Date()` there directly rather than converting.
- Do not add shared Date↔Temporal conversion helpers. At a `Date` boundary use the built-ins inline: `date.toTemporalInstant()` going in, `new Date(instant.epochMilliseconds)` going out.
- `Intl.DateTimeFormat.prototype.format` accepts Temporal objects directly, so do not round-trip through `Date` to format one.

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `nub run typecheck`, `nub run lint`, and `nub run format` before handing off changes. Do not run `nub run build` just to validate agent work unless the user explicitly asks for a build.
