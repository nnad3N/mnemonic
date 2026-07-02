# Branded Backend IDs

This app uses branded IDs to make backend database code harder to mix up. A `SafeId<"topic">`, `SafeId<"file">`, or `SafeId<"user">` is still a string at runtime, but TypeScript treats each tag as a different kind of ID.

The goal is not runtime validation. The goal is to make Drizzle calls explicit about which app-owned ID type they are using.

## Where Brands Live

- `SafeId`, `toSafeId`, `createSafeId`, and `rawId` live in `src/lib/safe-id.ts`.
- App-owned Drizzle IDs are branded in `src/db/schema.ts`.
- `topic.id` is `SafeId<"topic">`.
- `topic.userId` is `SafeId<"user">`.
- `file.id` is `SafeId<"file">`.
- `file.userId` is `SafeId<"user">`.
- `file.topicId` is `SafeId<"topic">`.

Do not brand Better Auth tables in `src/db/auth-schema.ts`. Better Auth owns that schema. Brand the authenticated `user.id` only after Better Auth returns the session in backend context.

## Backend Boundaries

Server functions still accept raw strings. Validators should stay as:

```ts
v.pipe(v.string(), v.nanoid());
```

After validation, brand IDs only when they are about to touch a branded backend surface, usually a Drizzle column.

Use `toSafeId` for raw IDs that have already crossed a trusted boundary:

```ts
// oxlint-disable-next-line eslint-js/no-restricted-syntax -- paired with userId check.
id: toSafeId<"topic">(data.topicId),
userId: context.user.id,
```

Keep the comment short and specific. Good reasons include:

- `paired with userId check.`
- `trusted auth session.`
- `trusted server context.`
- `server-generated ID.`
- `scoped by trusted topic.`

When branding an ID before checking ownership, the comment should say that ownership is being checked. When branding an ID from context, the comment should say the context is trusted.

## Creating IDs

Use `createSafeId` for app-owned IDs created on the backend:

```ts
const topicId = createSafeId<"topic">();
```

Do not call `toSafeId(nanoid())`. `createSafeId` owns that pattern.

## Returning IDs

Frontend and DTOs use raw strings. If a selected Drizzle ID would leak a brand into React, query keys, route params, or client-facing data, convert it with `rawId`.

```ts
return {
  id: rawId(row.id),
};
```

Only use `rawId` when TypeScript shows that a branded ID is crossing into a raw-string surface.

## Request Context

Mastra request context is set by server code before agent, tool, or workflow execution. Keep JSON schemas as raw nanoid strings, then brand request-context values when they are used with branded Drizzle columns.

If a tool uses a file ID from tool input together with a trusted topic ID from request context, brand the file ID only for that scoped lookup.

## Do Not

- Do not use branded IDs on the frontend.
- Do not change server function inputs from `v.string()` nanoids to branded types.
- Do not brand Better Auth schema columns.
- Do not destructure an input field only to pass it into `toSafeId`; use `toSafeId(inputData.fileId)` so the trust boundary stays visible.
- Do not silence `toSafeId` without a short reason.

Note: Mastra thread scope uses `thread.resourceId` and memory APIs use `resource` / `resourceId` — those are Mastra identifiers, not uploaded-file IDs.
