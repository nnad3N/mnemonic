# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bun run format`
- **Lint and autofix**: `bun run lint`
- **Format and lint**: `bun run fix`
- **Typecheck only**: `bun run typecheck`
- **Run tests**: `bun run test`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer `.at(index)` over bracket indexing (`array[index]`) unless you have already verified the index exists (e.g. after a bounds check or when iterating with a known-valid index)
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors
- In event handlers that call promise-returning functions, make the handler `async` and `await` the promise. Do not discard promises with `void` when the handler can be async.

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
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles
- **Variant styling** — do not add helper functions that map a discriminant to Tailwind class strings (e.g. `getStatusClassName(status)` with a `switch`). Either inline classes in JSX with `cn(..., condition && "class")`, or extract a small component that owns the variant markup:
- Keep static Tailwind class strings inline in JSX unless extracting a small component or using `cn(...)` materially improves conditional readability. Do not create local constants whose only purpose is to hold a reusable Tailwind class string for one file.

```tsx
// Good — inline
<span
  className={cn(
    "size-1.5 rounded-full",
    status === "ready" && "bg-green-500",
    status === "failed" && "bg-red-500"
  )}
/>;

// Good — component owns the variants
const ArtifactStatusChip = ({ status }: { status: ArtifactStatus }) => (
  <Badge variant="outline">
    <span
      className={cn(
        "size-1.5 rounded-full",
        status === "ready" && "bg-green-500",
        status === "failed" && "bg-red-500"
      )}
    />
    {label}
  </Badge>
);

// Bad — class-string lookup helper
const getStatusDotClassName = (status: ArtifactStatus) => {
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

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases
- **Never render raw error messages in client UI** — do not display `error.message`, provider/API payloads, stack traces, or other server-derived text. Show user-safe copy via Paraglide messages or an error-code lookup (see [`src/lib/auth-errors.ts`](src/lib/auth-errors.ts)); log details server-side for debugging

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns
- Do not export types, constants, functions, or components unless another module needs to import them. Keep module-local implementation details unexported.
- **Do not create new files unless necessary** — prefer editing an existing module when the change fits there (a local `const`, a helper in the same file, an export on an existing module). Only add a file when the code is reused across modules, the existing file is already too large, or the user explicitly asks for a new file. Example: a subagent tool name used only in [`tool-parts.ts`](src/lib/ai-sdk/tool-parts.ts) belongs as an inline constant in that file, not in a new `*.constants.ts`.

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
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## TanStack Router file routes

Every file under `src/routes/` follows the same shape. `createFileRoute(...)({ component: ... })` runs **before** the component is defined, so the component must be a **hoisted function declaration**, not an arrow function expression.

- Name the component **`RouteComponent`** for page routes and **`LayoutComponent`** for pathless layouts (`_*.tsx` / `_*/route.tsx`). Don't invent per-route names like `SignInRoute` or `AuthLayout` — keep the name uniform across files so jumping between routes is predictable.
- Disable `func-style` for the declaration with a file-scoped comment: `/* oxlint-disable func-style */` directly above `function RouteComponent() {`. This is the only place `func-style` should be disabled in the codebase; everywhere else, prefer arrow functions per the Modern JS guidance above.
- Reference the component by name inside `createFileRoute`:

```tsx
export const Route = createFileRoute("/some/path")({
  component: RouteComponent,
});

/* oxlint-disable func-style */
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
- Ensure **`Register.router`** uses `typeof router` on a module-level router instance (see [`src/router.tsx`](src/router.tsx)) — not `ReturnType<typeof getRouter>`.

Reference: [`src/routes/_protected.topic.$topicId/artifacts.tsx`](src/routes/_protected.topic.$topicId/artifacts.tsx)

---

## Valibot schemas

Use Valibot for every input boundary: server fn validators, middleware `inputValidator`, route `validateSearch`, env vars, tool/workflow schemas, and form `onDynamic` schemas.

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

Any schema field named `id` or ending in `Id` (`topicId`, `threadId`, `artifactId`, `userId`, `messageId`, …) must validate as a nanoid:

```tsx
topicId: v.pipe(v.string(), v.nanoid()),
messageId: v.optional(v.pipe(v.string(), v.nanoid())),
```

Reference: [`src/routes/_protected.topic.$topicId/-artifacts-api/list-artifacts.ts`](src/routes/_protected.topic.$topicId/-artifacts-api/list-artifacts.ts), [`src/lib/middleware/assert-thread-access.ts`](src/lib/middleware/assert-thread-access.ts)

---

## Forms

This project pairs **TanStack React Form** (validation/state) with **Base UI Form** (`@/components/ui/form`, `@/components/ui/field`) for the rendering layer. Follow this pattern for every form.

### Building a form

- **Schema with Valibot** at the top of the component, using Paraglide messages for error copy:

```tsx
const schema = v.object({
  email: v.pipe(
    v.string(),
    v.nonEmpty(m.auth_validation_required()),
    v.email(m.auth_validation_email_invalid())
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

- **Locate the schema inside the component** so Paraglide message getters re-evaluate per render and stay aligned with the active locale.

### Wiring validation errors to Base UI

- Use `toFormErrors` from [`src/lib/form-errors.ts`](src/lib/form-errors.ts) to flatten TanStack `fieldMeta` into the `Record<string, string>` shape Base UI's `<Form errors>` expects:

```tsx
const formErrors = useStore(form.store, (s) => toFormErrors(s.fieldMeta));
```

- Pass it on the form: `<Form errors={formErrors}>`.
- Each `Field` must set **`name={field.name}`** so Base UI can resolve `errors[name]`.
- Render errors with a self-closing **`<FieldError />`** — no `match` prop, no children, no manual `meta.errors` joining. Base UI handles the visibility based on the `errors` map.

### Submit button state

Subscribe narrowly to drive the submit button:

```tsx
<form.Subscribe
  selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}
>
  {({ canSubmit, isSubmitting }) => (
    <Button disabled={!canSubmit} loading={isSubmitting} type="submit">
      {m.auth_sign_in_submit()}
    </Button>
  )}
</form.Subscribe>
```

### API errors vs validation errors

- **Validation errors** (client-side, from the schema) → Base UI `<FieldError />` via the `toFormErrors` flow above.
- **Generic API errors** (e.g. Better Auth) → `toastManager.add(...)`. Translate via an error-code lookup (see [`src/lib/auth-errors.ts`](src/lib/auth-errors.ts)); never display raw provider messages.

### Submit handler shape

Always `preventDefault` + `stopPropagation` and forward to TanStack:

```tsx
<Form
  errors={formErrors}
  onSubmit={(event) => {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit();
  }}
>
```

### Reference implementations

- [`src/routes/_auth/sign-in.tsx`](src/routes/_auth/sign-in.tsx)
- [`src/routes/_auth/sign-up.tsx`](src/routes/_auth/sign-up.tsx)

---

## AI SDK UI tool parts

Helpers for rendering AI SDK v6 `UIMessage` tool parts live in [`src/lib/ai-sdk/tool-parts.ts`](src/lib/ai-sdk/tool-parts.ts).

- **`getToolPartStatus`** — maps a tool part's `state` to `pending` | `done` | `error`. Reuse this instead of duplicating switch logic in components.
- **`isVisibleToolPart`** — whether a tool name renders visible UI during streaming (meta-line labels plus custom delegation cards). Use this in streaming placeholder checks.
- **Subagent stream tool names** — Mastra supervisor `agents: { webSearch }` becomes `agent-webSearch`. Add subagent tool-name constants inline in [`tool-parts.ts`](src/lib/ai-sdk/tool-parts.ts).

When adding a new subagent with custom UI, add its `agent-<key>` name to `tool-parts.ts` and extend `isVisibleToolPart`.

---

## Internationalization (Paraglide)

Messages live in [`messages/en.json`](messages/en.json) and [`messages/pl.json`](messages/pl.json). Use Paraglide getters from `@/paraglide/messages` (`m.message_key()`).

- **`common_*` for generic UI copy** — reuse shared keys for words and short phrases that mean the same everywhere (`common_loading`, `common_retry`, `common_try_again`, `common_please_try_again`, `common_cancel`, `common_delete`, `common_search`, `common_rename`, `common_download`, `common_sign_out`, `common_no_results`, status labels, table column headers, etc.). Do **not** create feature-scoped one-offs when a `common_*` key already fits.
- **Feature-scoped keys** (`chat_*`, `artifacts_*`, `nav_*`, …) are for context-specific copy only: page titles, empty-state descriptions, error explanations, placeholders tied to a screen or domain concept.
- When adding a string, check `common_*` first before introducing a new key.

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `bun run typecheck`, `bun run lint`, and `bun run format` before handing off changes. Do not run `bun run build` just to validate agent work unless the user explicitly asks for a build.
