# Mnemonic domain glossary

Shared nouns. Use these words in code, commits, and agent copy. Implementation detail lives in `CODING_STANDARDS.md`.

## topic

A research subject the user works in. Owns threads and files. `SafeId<"topic">` in Drizzle.

## thread

A chat conversation scoped to one topic. Mastra memory and the sidebar list threads per topic.

## file

An uploaded document attached to a topic. `SafeId<"file">` in Drizzle. Distinct from Mastra `resourceId` / `thread.resourceId`.

A file's **content** is stored as rows of text: one per page for formats that have pages (PDF, DOCX), one holding the whole text otherwise. `file_content` in Drizzle; `page` is null when the format has no pages.

## note

A markdown document the user owns. Work from a thread that is kept. Scoped to a thread or a topic. `SafeId<"note">`.
_Avoid_: memory (Mastra agent memory; the user never sees it)

## user

The signed-in account. `SafeId<"user">` after Better Auth returns the session. Better Auth schema columns stay unbranded.

## providerKey

A stored API key for an LLM provider (BYOK). `SafeId<"providerKey">` in Drizzle.

## kit

A named backend capability tuple (`dbKit`, `memoryKit`, `s3Kit`, `vectorKit`). Application logic runs through `Kit.gen` with an injected context. See `CODING_STANDARDS.md` (Kit services).

## SafeId

A compile-time brand on app-owned ID strings (`SafeId<"topic">`, …). Runtime they are still strings. Brand only at trusted backend boundaries.

## server fn

A TanStack Start `createServerFn` wrapper in a `*.functions.ts` file. The thin network boundary; heavy logic lives in `*.server.ts` kit actions.
