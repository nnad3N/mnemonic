# Logging for mnemonic: wide events, OTel-compatible, with a swappable error reporter

## Want

A logging implementation for mnemonic. Generic, and compatible with OTel logging. Error logging is
a separate concern handled by utils behind an adapter, so one deployment reports to PostHog and
another reports somewhere else.

The shape follows the wide-event pattern from https://loggingsucks.com/: one context-rich record per
unit of work, accumulated mutably as the work proceeds, rather than scattered log lines. The pattern
may be simplified for mnemonic's scale but not discarded.

## Problem

There is no logger. Logging happens through 18 `console.*` calls, almost all of them
`console.error(err)` with no structure, no correlation, and no business context.

The `process-file` workflow is the case that makes this concrete: `processForRagFn` has five
terminal branches and roughly ten failure points, and the workflow's `options.onError` receives only
`getInitData()`. A failed upload therefore records a file id and nothing about which branch failed.

## Decisions

- Logging must be generic and work with OTel logging.
- Code is provider-agnostic. Adapters to a specific provider (PostHog or otherwise) come later.
- Configuration is env-driven.
- The mutable wide event is in scope now, not deferred.
- The design should read as it would if written in Rust: owned typed values and enums, not ambient
  stringly-typed mutable state.
- Nothing personal is logged. Only metrics and error messages.
- Error messages are logged by default. Sensitive content in an error message is the fault of the
  code that put it there. The one exception is the AI SDK, whose errors carry the whole
  conversation; those are minimized before logging.
- The error reporter is errors only. No product analytics.
- All three units of work get a wide event in the first pass: server-fn call, chat run, workflow
  step.
- Only unexpected errors are logged and reported. Expected outcomes such as not-found are not.
  Logging happens at the boundary, not on every `Err` return, and before the error is transformed
  (for example into a `ServerFnError`) so no information is lost.
- Browser errors are in scope, except those the backend already logs: server-fn errors that
  round-trip to the client are not logged again.
- "Metrics" means fields on the wide event. No separate numeric metrics signal.
- Browser errors go through a browser-side adapter registry with a browser SDK, configured through
  `VITE_` env. Not relayed to the server.
- All three browser surfaces are in scope: query/mutation cache (filtered to exclude
  `ServerFnError`), the chat transport `onError`, and the root `errorComponent`.
- Levels: `info` for a successful unit of work, `warn` for degraded-but-served, `error` for a failed
  unit of work and for process-level failures outside any unit of work.
- The error reporter exposes `identify(userId)`.
- Mnemonic owns its logging interface, with typed events per unit of work. Mastra's logger is one
  consumer behind it, so Mastra-internal logs land in the same sink. Pino, OTel, or any other
  backend is an adapter behind the interface.
- Mastra `Observability` is always on, with no gate. It exports over OTLP to whatever OTel provider
  the deployment configures.
- The browser reports errors only. No browser wide events.

## Facts

### The repo has no logger

18 `console.*` call sites, all `console.error` except one `console.warn` in a build script:

- `src/lib/kit/index.ts:86` — the throwing boundary shared by every server function
- `src/start.ts:19` — server-fn middleware, logs `serverFnMeta.name` and the error
- `src/routes/api/chat.ts` — 9 sites (`:100`, `:134`, `:138`, `:144`, `:238`, `:257`, `:267`, `:299`, `:319`, `:326`)
- `src/routes/api/-chat-shared.server.ts:78`
- `src/lib/durable-agents-kit.server.ts:27` — Redis client error handler
- `src/lib/tanstack-query/root-provider.tsx:12` and
  `src/routes/_protected.chat.$threadId/-hooks/use-thread-chat.ts:80` — the two client surfaces
- `src/lib/docs/scripts/generate.server.ts:368` — CLI output from a build script, not app logging

### Units of work in the repo

Three, each with an existing boundary that sees start and end:

1. **Server-fn call.** `src/start.ts` function middleware; `serverFnMeta` carries `name` and
   `filename`. Every server fn throws through `Kit.run(...).throws()` in `src/lib/kit/index.ts`.
2. **Chat run.** `src/routes/api/chat.ts`. The HTTP handler returns while the durable run streams
   on; `settleRun` is the end, and it already holds `status`, `runId`, `threadId`, `timing`,
   `userId`, `userMessageId`. `thread_run` (`src/db/schema.server.ts:159`) stores `runId`,
   `agentId`, `status` (`"aborted" | "running" | "finished" | "errored" | "interrupted"`),
   `versionedNoteIds`, `startedAt`, `finishedAt`. `RunTiming.workTimings` is the per-run work
   segments (`src/lib/durable-agents-kit.server.ts:60`).
3. **Workflow step.** `process-file` in
   `src/routes/_protected.chat.$threadId/-thread-api/upload-file-workflow.server.ts`, two steps:
   `validate-file` and `process-for-rag`. Each step's `execute` is a `Kit.run(...).throws()`.
   Durable runs may resume in another process, so a step, not the run, is the unit that keeps one
   async context.

### Existing boundary behaviour that matches the error decision

`Kit.run(...).throws(mapError)` in `src/lib/kit/index.ts:80-95` already logs the _original_ error
before applying `mapError`, and skips the log when the error is a `ServerFnError`. That is the
"unexpected only, before transform" rule; it just writes to `console.error`.

### Browser error surfaces

Three, all currently `console.error` or nothing:

- `src/lib/tanstack-query/root-provider.tsx:11` — one `logCacheError` shared by `QueryCache` and
  `MutationCache` `onError`. Server-fn errors arrive here as deserialized `ServerFnError` via the
  adapter in `src/start.ts:7`; network failures and non-server-fn throws arrive as anything else.
- `src/routes/_protected.chat.$threadId/-hooks/use-thread-chat.ts:79` — `onError` of the AI SDK
  chat transport: stream drops, aborted fetches, malformed chunks.
- `src/routes/__root.tsx:44` — `errorComponent` for render-time errors; it renders but does not
  report.

### Branches in the upload workflow

`validateFileFn` fails with `FileProcessingError`, which already carries a `reason` of
`"file-not-found" | "invalid-status" | "size-mismatch"` plus `actualSize`/`expectedSize`.

`processForRagFn` terminal branches: image short-circuit, extraction fallback when Kreuzberg returns
no pages, empty-chunks short-circuit, and the full indexed path. Four of the five terminal returns
collapse to the same `{ fileId }`. Failure points include the S3 fetch and provider-key resolution
(combined in one `Kit.promiseAll`, which loses which member failed), extraction, embedding, the
description call, `createIndex`, `upsert`, and the final transaction.

### What to log: fields per unit of work

Wide events are fields on one record, queried later, not a separate metrics signal
(https://loggingsucks.com/). OTel attribute naming is dotted snake_case; `error.type` must be low
cardinality (a class or tag name, never a message) and is set only on failure
(https://opentelemetry.io/docs/specs/semconv/http/http-spans/).

**On every event**: `timestamp`, `service`, `env`, `trace_id` and `span_id` (from
`resolveTraceFields()`, present only inside a Mastra span), `duration_ms`, `outcome` (an enum, not
a free string), `user_id`, and on failure `error.type`, `error.message`, plus `error.reason` when the
tagged error defines one.

**Server-fn call**: `fn.name`, `fn.file`, `http.request.method`, `outcome`, `error.status` (the
`ServerFnError.status` union — `not-found`, `unauthorized`, `server-error`, `bad-request`,
`forbidden`, or a custom code).

**Chat run**: `run_id`, `thread_id` (OTel `gen_ai.conversation.id`), `topic_id`, `agent_id`
(`MnemonicAgentId`), `model_option`, `trigger` (`submit-message` | `regenerate-message`), `status`
(`ThreadRunStatus`), `finish_reason` (the parsed picklist in `chat.ts`), a work-timing summary
(count and total ms), `versioned_note_count`, `duration_ms` from `startedAt` to `finishedAt`, and
`trace_id`. Not token counts, cost, TTFT, response model, or per-step finish reasons: Mastra's
`MODEL_GENERATION` span already carries `usage`, `costContext`, `finishReason`, `responseModel`,
`responseId`, `completionStartTime`, `streaming`, `parameters`
(`node_modules/@mastra/core/dist/observability/types/tracing.d.ts:227`), and `TOOL_CALL` spans
carry `toolCallId`, `success`. The run event links to that detail by `trace_id`; repeating it on
the event is the bag problem.

**Workflow step (`process-file`)**: `workflow_id`, `step_id`, `run_id`, `file_id`, `topic_id`,
`mime_type`, `size_bytes`, `outcome` as a union whose variants carry their own data —
`image-skip`, `no-chunks`, `indexed` with `page_count`, `chunk_count`, `description_length` — plus
`pages_extracted` (whether Kreuzberg returned real pages or the code fell back to whole-document),
`embedding_model`, `duration_ms`. On failure `error.type`, `FileProcessingError.reason`,
`expected_size`, `actual_size`.

Embedding usage is **not** captured anywhere today: the step calls `embedMany` from `ai` directly,
which produces no Mastra span. `RagEmbeddingAttributes` (`inputCount`, `dimensions`, `usage`) and
`RagVectorOperationAttributes` only appear through `startRagIngestion` / `withRagIngestion` from
`@mastra/core/observability`.

**Error report payload** (adapter input): `error.type`, `message`, the `cause` chain's types, the
event's ids, `trace_id`. For AI SDK `APICallError`: keep `url`, `statusCode`, `isRetryable`; drop
`requestBodyValues` (the full request, i.e. the conversation), `responseBody`, `responseHeaders`.
Verified shape: `APICallError` has `url`, `requestBodyValues: unknown`, `statusCode?`,
`responseHeaders?`, `responseBody?: string`, `isRetryable`, `data?`
(`@ai-sdk/provider` `index.d.ts:38`, re-exported from `ai`).

OTel GenAI conventions, for naming where mnemonic emits its own fields: `gen_ai.operation.name`,
`gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`,
`gen_ai.response.finish_reasons`, `gen_ai.usage.input_tokens` / `output_tokens` /
`cache_read.input_tokens`, `gen_ai.conversation.id`; content attributes
(`gen_ai.input.messages`, `gen_ai.output.messages`, `gen_ai.system_instructions`) are opt-in.
https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md

### Mastra already ships most of the seams (`@mastra/core@1.63.2`)

From `node_modules/@mastra/core/dist/_types/@internal_core/dist/index-GMaodH8q.d.ts`:

- `IMastraLogger` has `trackException(error, metadata)`, distinct from `error()`.
- `AdaptableLogger.__attachObservability(ctx)` is the supported hook for a logger to receive trace
  correlation and observability export.
- `resolveTraceFields()` (`@mastra/core/logger`) returns `{ trace_id, span_id? }` for the active
  span, AsyncLocalStorage-backed, so non-Mastra code in the same async context can correlate.
- `ConsoleLogger` is the built-in default; `LogFilter` filters by component/level/message.
- `LoggerContext` (`@mastra/core/observability`) is the `debug/info/warn/error/fatal` sink;
  `ExportedLog` is its wire shape (`logId`, `timestamp`, `traceId`, `spanId`, `level`, `message`,
  `data`, `correlationContext`).

Not installed today: `@mastra/loggers` (1.3.1), `@mastra/observability` (1.17.5),
`@mastra/otel-exporter` (1.3.13).

Tracing is opt-in: `@mastra/core/observability` is a no-op until an `Observability` instance from
`@mastra/observability` is passed to the `Mastra` constructor
(`node_modules/@mastra/core/dist/observability/index.d.ts`). Without it there are no spans, and
`resolveTraceFields()` returns `undefined` everywhere, so nothing carries a `trace_id`.

Neither Mastra logging interface types its fields: `IMastraLogger` methods take
`(message: string, ...args: any[])`, and `LoggerContext` takes
`(message: string, data?: Record<string, unknown>)`.

- `PinoLogger` (`@mastra/loggers`) options: `name`, `level`, `transports`,
  `overrideDefaultTransports`, `prettyPrint` (default true), `formatters`, `redact`, `mixin`,
  `customLevels`, `serializers`. https://mastra.ai/reference/logging/pino-logger
- `Observability` takes named config profiles with `serviceName`, `sampling`, `exporters`,
  `logging: { enabled, level }`, `spanOutputProcessors`, `spanFilter`, `excludeSpanTypes`,
  `serializationOptions`, `requestContextKeys`. https://mastra.ai/docs/observability/tracing/overview
- `OtelExporter` (`@mastra/otel-exporter`) exports `signals: { traces, logs }` over OTLP and needs a
  protocol-specific peer dep (`@opentelemetry/exporter-trace-otlp-proto` / `-http` / `-grpc`).
  https://mastra.ai/docs/observability/tracing/exporters/otel
- `@mastra/otel-bridge` is experimental and bridges Mastra spans into an existing OTEL
  AsyncLocalStorage context.
- Mastra spans are automatic for agent runs, LLM calls, tool executions, memory operations, workflow
  runs and steps. `tracingContext.currentSpan.update({ metadata })` and `.createChildSpan(...)` add
  to them. Agent and workflow results expose `traceId`.

### What loggingsucks.com actually claims

The problem is shape, not the logger: scattered lines have no structure and no correlation. The fix
is one wide event per unit of work carrying high-cardinality business fields, built up across the
request and emitted once. Tail sampling is its cost-control answer, aimed at 10k concurrent users.
It states explicitly that OpenTelemetry is a delivery mechanism and decides nothing about what you
log.

### Rust equivalents

The reference implementation of this pattern is the `tracing` crate. A span declares its field set
at creation; fields left `Empty` can be filled later with `Span::record`, but new keys cannot be
invented mid-flight. Spans nest and carry durations, events are points in time, subscriber layers do
filtering and formatting, `tracing-opentelemetry` bridges to OTLP, and completion is RAII via the
span guard's drop.

## Out of scope

- Product analytics through the error reporter.
- Tail sampling.
- A separate numeric metrics signal.
- Browser wide events and a browser log sink.
- Relaying browser errors through the server.
- Logging expected outcomes (not-found, unauthorized, bad-request, forbidden) as errors.
