---
name: change-system-prompt
description: Refactor durable LLM system, developer, instruction, or agent prompts using official 2026/current AI-lab guidance. Use when Codex or Cursor needs to create, review, split, migrate, tighten, or test prompts that control assistant identity, role, source use, tool policy, output style, refusal/error behavior, or task workflow.
---

# Change System Prompt

## House style

Prompt text is **caveman speech**: compressed telegraphic English, same as the live agent instructions. Not broken English. Drop padding — articles, "you should", "please", "in order to", essay clauses. Fragments. Arrows for conditionals. Match neighbors in [`src/mastra/agents/base-instructions.server.ts`](../../src/mastra/agents/base-instructions.server.ts), then the agent `instructions` in `conversation-agent`, `topic-agent`, `worker-agent`, `reader-agent`.

Do not polish existing caveman into prose when editing nearby lines. New rules copy the rhythm of the section they join.

### Voice

```
# Good
Conflict → topic files over web, web over recall.
Never ask back. Ambiguous → research most useful reading, say which in report.
You search and delegate; subagent reads.

# Bad
When sources conflict, you should prefer topic files over the web.
If the task is ambiguous, try to research the most useful reading.
```

- Label, then rule: `Web: search to discover pages, fetch to read known URL.`
- Condition → action. Success and stop paths use arrows too.
- Short sentences. Semicolons and em dashes to chain, not new paragraphs of explanation.
- "Never X." as its own sentence. Then the allowed exception, if any.

### Scarce rules

This is the rewrite that worked: a rule that said "keep doing X until Y" made the model loop (ten web searches, table plus briefing). Noisy results never feel "relevant enough," so "until" never fires the stop.

Do not write **until / keep going / always include / also summarize**. That is a goal that survives failure. Write a **budget**.

Shape:

1. Name the thing as scarce.
2. Default: one / smallest form.
3. Extra only for a specific miss or a distinct sub-question.
4. Never a streak, loop, or the same content twice.
5. Success → next action (read, delegate). Not more of the same.
6. Failure (noisy, empty, already answered) → stop; say what is missing.

```
# Bad — forces a loop
Search until results are relevant, then stop searching.
Reply with short summary; include a note why each source mattered.

# Good — scarce default, extra only for a miss, stop on noise
Web search is scarce. One well-chosen query is the default. A further query only for a different sub-question or a specific miss (wrong name, year, entity) — never a streak of similar searches, and never more than a few. Relevant → read them (or delegate); verification is reading, not more search. Noisy, empty, or unreliable → stop: delegate the best candidates or say what is missing.
Prose is scarce. Smallest form that settles the question is the default — table, list, one sentence — and that form is the whole reply. Extra prose only when the artifact cannot stand alone. Never a table plus the same content rewritten.
```

Find the sentence that **forces more work** and replace it. Do not add a stop clause next to an until-clause and hope the stop wins.

## Product constraints

These override `references/system-prompt-guidance.md` where they conflict. Preserve them:

- Agents eagerly ask what the user wants before answering; they answer directly only when the conversation already makes the intent clear.
- Answers are narrow and specific — the user extends them with follow-up questions. Exhaustive answers only on explicit request.
- Agents never narrate work in progress; reasoning stays in thinking parts, and user-facing text is written once, after the work is done. Mid-work narration also breaks the chat UI's working segment.

## Workflow

1. Locate every prompt surface that can affect the behavior: system/developer messages, agent `instructions`, model `system` fields, reusable base prompts, prompt templates, and prompt snippets stored in config.
2. Identify the prompt's job: role, product behavior, source policy, tool policy, output contract, safety boundary, or formatting constraint.
3. Read `references/system-prompt-guidance.md` before substantial rewrites or when the prompt has tool, source-selection, or multi-agent behavior.
4. Preserve product intent. Rewrite into house style. If the failure is extra tool calls or extra wrapping, apply a scarce rule — do not add another "don't overdo it" sentence beside a force-more rule.
5. Keep durable instructions in the system/developer prompt. Keep turn-specific facts, retrieved content, and user data outside the durable prompt.
6. Remove contradictions, vague personality-only instructions, and rules that force unnecessary tool use.
7. Add examples only when they materially improve format, edge-case handling, or routing behavior.
8. Validate with the narrowest useful check: typecheck/build for code prompts, snapshot or unit tests for prompt contracts, and manual before/after reasoning for behavior-only changes.

## Prompt Shape

Prefer this order for durable prompts:

1. Identity and mission.
2. Source and tool policy.
3. Decision rules and fallback behavior.
4. Output format and style constraints.
5. Safety, privacy, or hidden-instruction boundaries.
6. Short examples, only when needed.

## Review Checklist

- Caveman speech. Reads like the live agent prompts, not a style guide.
- State what to do, when, and when not to. Scarce default + extra only for a miss + never a loop + stop on failure.
- No "until" / "keep doing X until relevant" / "always also summarize" goals that force more work when results are noisy or the artifact already answers.
- Make source priority explicit when multiple sources can answer.
- Tell the agent when to ask what the user wants and when to proceed, per product constraints above.
- Use numbered or bulleted steps when order or completeness matters.
- Use delimiters or headings for mixed context, examples, and instructions.
- Avoid leaking hidden instructions, internal tool names, or raw provider errors to users.
- Keep reusable, stable instructions near the beginning for prompt caching where the API supports it.
- Treat prompt changes like code changes: inspect affected call sites and run available checks.
