# Mastra scorers for testing prompt changes locally

## Want

Learn evals by using Mastra scorers on mnemonic, run locally, to catch regressions and confirm improvements after prompt or model changes.

## Problem

Prompt edits regress agent behaviour (delegation, asking before answering, note quality) and there is no signal beyond reading transcripts.

## Decisions

- Not an enterprise setup. No safety or compliance scorers (toxicity, bias, PII, injection).
- No regression has happened yet; the app is not deployed. Scorers are for learning and for catching future prompt regressions.
- Offline dataset runs, not live sampling.
- Judge model: follow the Mastra docs recommendation.
- Scores are viewed in Mastra Studio, run locally. All evals run locally.
- First scorers, to be expanded later: (a) parent delegated bulk work, code-only `calledTool` check; (b) agent asked before answering an ambiguous request, `multi-turn-judge` with a plain-English criterion; (c) note faithfulness to sources, built-in `faithfulness` with tool outputs as context.
- Judge model: cheap model through `getChatModel` with the stored key, since the provider stays behind config and the docs recommend nothing.
- Dataset items are hand-written and small.
- Two datasets, one per parent agent (conversation, topic); ask-first and faithfulness items shared between them.
- Delegation and ask-first items run real tools. Faithfulness items mock web fetch and file read via `toolMocks` with `unmockedToolPolicy: 'deny'`.
- Studio runs via `mastra dev --dir evals` on a top-level `evals/` folder whose `index.ts` imports the app's `mastra` instance. The app tree stays untouched.
- Scorers and dataset seeds live in `evals/`.
- A seed script run with `nub` creates both datasets and their items from typed literals, so they are versioned and re-seedable after `docker:reset`.
- Experiments run and compare from Studio only. No experiment script.
- The seed script creates a dedicated eval user, thread and key rows (key copied from the dev user) and stamps their ids into every item's request context.
- The seed script also creates an eval topic with a few short notes so topic-agent items exercise note search and read, and faithfulness items have sources to read.

## Facts

- No scorers exist and `@mastra/evals` is not installed (`package.json`).
- Registered agents: `conversationAgent`, `topicAgent` (`src/mastra/instance.server.ts`). Worker and reader agents are subagents (`src/mastra/agents/`).
- Live scoring: `new Agent({ scorers: { key: { scorer, sampling: { type: 'ratio', rate }, filter? } } })`. Runs async after the response. Results stored in `mastra_scorers`. https://mastra.ai/docs/evals/overview
- Offline: `runEvals({ target, data, scorers, gates?, targetOptions? })` from `@mastra/core/evals` (renamed from `runExperiment` in v1). Returns averages for the current run only, no baseline comparison. https://mastra.ai/reference/evals/run-evals
- Baseline comparison: Datasets and Experiments. `mastra.datasets.create()`, `dataset.startExperiment({ targetType, targetId, scorers })`, `compareExperiments({ experimentIds, baselineId })`. Persists to `mastra_datasets`, `mastra_experiments`, `mastra_experiment_results`. Needs a storage adapter with the `datasets` domain. Studio has a Compare view. https://mastra.ai/docs/evals/datasets/running-experiments
- Viewing: Mastra Studio shows scorer lists, score details with reason, an agent Evaluate tab, and scoring of historical traces from Observability. Not needed for `runEvals`, which returns results in code.
- Built-ins (`@mastra/evals/scorers/prebuilt`). LLM judge: answer-relevancy, answer-similarity, faithfulness, hallucination, completeness, tool-call-accuracy (LLM), trajectory-accuracy (LLM), prompt-alignment, multi-turn-judge (grades each assistant turn against a plain-English criterion), context-precision, context-relevance, tone-consistency, toxicity, bias. Code-only: content-similarity, textual-difference, keyword-coverage, tool-call-accuracy code variant (`expectedTool` / `expectedToolOrder`), trajectory-accuracy code variants, and quick checks `calledTool / didNotCall / toolOrder / maxToolCalls / usedNoTools / noToolErrors / includes / excludes / matches`. https://mastra.ai/docs/evals/built-in-scorers
- Custom: `createScorer({ id, description, judge?: { model, instructions }, type: 'agent' })` with `.preprocess/.analyze/.generateScore/.generateReason`, each a function or a judge prompt. https://mastra.ai/docs/evals/custom-scorers
- Trace visibility: a live scorer sees only input and output messages plus flat `toolInvocations` of that agent. Nested subagent tool calls appear only in offline trajectory scorers (`AgentScorerConfig.trajectory`), which receive a `Trajectory` of nested steps built from stored observability spans. https://mastra.ai/reference/evals/trajectory-accuracy
- Subagents: an `Agent` used as a tool can carry its own `scorers`; scores land under its own entity id.
- Workflow steps accept `scorers` on `createStep`.
- Every tool reads `providerKeyId`, `userId`, `modelOption`, `threadId` and optional `filter.topicId` off the request context (`src/mastra/request-context.server.ts`). Dataset items carry a `requestContext`, so each item needs a real user, stored key and thread row in the local database for real-tool runs. Experiments give memory agents a fresh Mastra thread per item.
- `package.json` already has `mastra:dev`, `sandbox:docs` runs a script with `nub`; the same shape works for a seed script.
- Judge model: docs give no recommendation. Examples use `openai/gpt-5-mini` for the judge. https://mastra.ai/docs/evals/custom-scorers
- Studio: served by `mastra dev`, which expects `index.ts` exporting `mastra` in `src/mastra` (or `--dir`). No flag for a different file name. This repo exports from `src/mastra/instance.server.ts` and has no `index.ts`; the `mastra` CLI (^1.27) and a `mastra:dev` script are already in `package.json`. `mastra studio` is a static UI that connects to a running Mastra API server on port 4111. https://mastra.ai/reference/cli/mastra
- `@mastra/pg` 1.22 implements the `datasets` and `experiments` domains (`node_modules/@mastra/pg/dist/storage/domains/{datasets,experiments}`), including tool mock persistence. https://mastra.ai/docs/evals/experiments
- Tool mocks: per dataset item, `toolMocks: [{ toolName, args, output, matchArgs: 'strict' | 'ignore' }]`, consumed in order once each. `unmockedToolPolicy: 'allow' | 'deny'` per experiment or item; `deny` fails on any unmocked call. Mocking applies only to agent targets. `matchArgs: 'ignore'` is meant for subagent mocks with LLM-generated args.

## Out of scope

- Guardrails / input-output processors from Mastra docs.
- Prompt injection handling on file display names.
