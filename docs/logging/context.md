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
- Error reporting is an adapter, so the backend (PostHog or otherwise) is swappable per deployment.
- The mutable wide event is in scope now, not deferred.
- The design should read as it would if written in Rust: owned typed values and enums, not ambient
  stringly-typed mutable state.

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

### Branches in the upload workflow

`src/routes/_protected.chat.$threadId/-thread-api/upload-file-workflow.server.ts`

`validateFileFn` fails with `FileProcessingError`, which already carries a `reason` of
`"file-not-found" | "invalid-status" | "size-mismatch"` plus `actualSize`/`expectedSize`.

`processForRagFn` terminal branches: image short-circuit, extraction fallback when Kreuzberg returns
no pages, empty-chunks short-circuit, and the full indexed path. Four of the five terminal returns
collapse to the same `{ fileId }`. Failure points include the S3 fetch and provider-key resolution
(combined in one `Kit.promiseAll`, which loses which member failed), extraction, embedding, the
description call, `createIndex`, `upsert`, and the final transaction.

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

## Open

- What counts as a unit of work in mnemonic, and how many kinds there are.
- Whether the mutable event is mnemonic-owned state or Mastra span metadata, given that Mastra spans
  do not exist outside agent and workflow code.
- Which failures are worth an error-report versus a log line only.
- What must never appear in a log, given BYOK and user documents.
- Where logs are read, which decides the default sink.
