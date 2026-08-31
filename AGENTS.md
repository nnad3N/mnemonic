# Mnemonic

A self-hosted research tool for one person. Each thread is a function. Highly unstructured data goes in. High-quality output comes out: a short reply, or a note you keep and chain into the next piece of work.

## The bar

**One person.** Self-hosted, BYOK, every model. Built as a workspace for a single user. Teams and shared workspaces are out of scope. That does not lower the bar on quality, security or performance.

**Composable blocks.** Few features, each a generic block the user combines. A block can be deep. It has to compose. This is how the app stays able to pivot when chat changes.

**Idiomatic first.** Ship correct, secure, and fast code. Do not trade those away to finish sooner. Most problems already have a well-tested solution. Find it. Use the simplest one that fits.

**Quiet UI.** Show little. A control that has not earned the first plane goes in a menu. Mobile and desktop get the same attention. The first use is the hard one. After that, add a label or tooltip only when the control is rare and its purpose is not obvious.

## Naming conventions

**kebab-case** for files, discriminated union keys, other union members, and statuses. `keep-sidebar.tsx`, `'in-progress'`.

**UPPER_SNAKE_CASE** for consts.

**camelCase** for ordinary JavaScript. Functions, variables, parameters, properties.

**PascalCase** for classes. Better Result errors and Kit.literals too, even though the literals are const. `DatabaseError`, `ImageMimeType`.

### `.functions.ts` and `.server.ts`

`.functions.ts` is the API. Query and mutation factories live here, with the `createServerFn` wrappers that declare the backend shape and call Kit. Never test it.

`.server.ts` has the business logic. Test that.

### Query key factories

One factory per feature, named `{resource}Queries`, in that feature's `.functions.ts`. Always array keys, most generic to most specific, each level spreading the parent. `as const` on every entry. This is TkDodo's factory from [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys):

```
const todoQueries = {
  all: ['todos'] as const,
  lists: () => [...todoQueries.all, 'list'] as const,
  list: (filters: string) => [...todoQueries.lists(), { filters }] as const,
  details: () => [...todoQueries.all, 'detail'] as const,
  detail: (id: number) => [...todoQueries.details(), id] as const,
}
```

Methods are `all`, `lists`, `list`, `details`, `detail`. Segments are the resource (`todos`), then `list` or `detail`. Filters sit in an object. Wrap the leaves in `queryOptions`. `all`, `lists`, and `details` stay key-only so prefix invalidation still works.

## How to write code

Utilize constraint-driven design. First decide what the code may do and what it may not. Those constraints are the rules every function and component follows. Validate them inside the function or component as early as possible.

Fight for the smallest model that makes the correct behavior obvious without compromising the readability of the code.

Write like a lazy engineer. Import a trusted abstraction from a package this repo already uses before inventing a local copy. Reuse a function that already lives here when it fits. Every new function is maintenance and review load. Before adding code, name why adding it is a bad idea.

Do not comment code that explains itself. A comment earns its place only when it records something the code cannot: a workaround and the quirk it works around, an ordering that is load-bearing, a constraint that lives outside the file. Never restate a name, a signature, or the lines below it, and never write a doc comment just because a function is exported. State the fact plainly and stop; do not argue for the code. Comments move when the code moves.

When writing code always follow [`CODING_STANDARDS.md`](CODING_STANDARDS.md). They describe in detail how you should structure and write code.

## Glossary

[`CONTEXT.md`](CONTEXT.md)

## Where code lives

- `src/components/` is where UI and other custom global components live.
- `src/db/` is where drizzle schemas and SQL utils live.
- `src/hooks/` is where global hooks live.
- `src/lib/` is where global utilities and everything that doesn't belong to one feature lives.
- `src/mastra/` is where chat agents, tools, workflows live.
- `src/routes/` is where all features live as vertical slices, all of the code is colocated.

## Verifying

`nub run typecheck`, `nub run lint`, and `nub run format` are fine on the scope you changed.

Test the behavior, not the implementation. Do not test things that are already tested, e.g. whether a `<button />` renders a button.

Run tests for the files you touched. Do not run `nub run test` until you perform review.

Do not use a browser unless asked. When asked, follow the verify-in-browser skill.
