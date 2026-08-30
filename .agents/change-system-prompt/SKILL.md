---
name: change-system-prompt
description: Caveman agent system prompts. Use when creating, reviewing, splitting, migrating, or tightening Mastra agent instructions, developer messages, or durable prompt policy in base-instructions.server.ts.
---

# Change system prompt

## House style

Prompt text is **caveman speech**: compressed telegraphic English, matching the live agent instructions. Not broken English. Drop padding: articles, "you should", "please", "in order to", essay clauses. Fragments. ASCII arrow `->` for conditionals, never `→`. Comma, colon, or a new sentence in prompt text. No em dashes. Match neighbors in [`src/mastra/agents/base-instructions.server.ts`](../../src/mastra/agents/base-instructions.server.ts), then the agent `instructions` in `conversation-agent`, `topic-agent`, `worker-agent`, `reader-agent`.

New rules copy the rhythm of the section they join. Nearby caveman stays caveman.

### Voice

```
# Good
Conflict -> topic files over web, web over recall.
Ambiguous -> research most useful reading, say which in report.
You search and delegate; subagent reads.

# Bad
When sources conflict, you should prefer topic files over the web.
If the task is ambiguous, try to research the most useful reading.
```

- Label, then rule: `Web: search to discover pages, fetch to read known URL.`
- Condition -> action. Success and stop paths use the arrow too.
- Short sentences. Semicolons or commas to chain, not new paragraphs of explanation.
- Positive over negative. Each case is condition -> action, with a concrete example ("User gave one file or one link -> read it yourself. Anything else -> reader: second file or link, any page or file you found"). Enumerate the cases. A "Never X." on an ambiguous line is a patch. Negation only where no positive form exists.

### Scarce rules

A keep-doing-X-until-Y rule made the model loop: ten web searches, a table plus a briefing. Noisy results never feel relevant enough, so until never stops.

Write a **budget**. `until` / `keep going` / `always include` / `also summarize` is a goal that survives failure.

Shape:

1. Name the thing as scarce.
2. Default: one / smallest form.
3. Extra only for a specific miss or a distinct sub-question.
4. Never a streak, loop, or the same content twice.
5. Success -> next action (read, delegate). Not more of the same.
6. Failure (noisy, empty, already answered) -> stop; say what is missing.

```
# Bad. Forces a loop
Search until results are relevant, then stop searching.
Reply with short summary; include a note why each source mattered.

# Good. Scarce default, extra only for a miss, stop on noise
Web search is scarce. One well-chosen query is the default. A further query only for a different sub-question or a specific miss (wrong name, year, entity). Never a streak of similar searches, never more than a few. Relevant -> stop searching and use them; verification is reading, not more search. Noisy, empty, or unreliable -> stop, then delegate the best candidates or say what is missing.
Prose is scarce. Smallest form that settles the question is the default: table, list, one sentence. That form is the whole reply. Extra prose only when the artifact cannot stand alone. Never a table plus the same content rewritten.
```

Find the sentence that **forces more work** and replace it. A stop clause beside an until-clause loses.

## Product constraints

These override `references/system-prompt-guidance.md` where they conflict. Preserve them:

- Agents eagerly ask what the user wants before answering. They answer directly only when the conversation already makes the intent clear.
- Answers are narrow and specific. The user extends them with follow-up questions. Exhaustive answers only on explicit request.
- Write user-facing text once, after the work is done. Reasoning stays in thinking parts. Mid-work narration also breaks the chat UI's working segment.

## Workflow

1. Locate every prompt surface that can affect the behavior: system/developer messages, agent `instructions`, model `system` fields, reusable base prompts, prompt templates, and prompt snippets stored in config.
2. Identify the prompt's job: role, product behavior, source policy, tool policy, output contract, safety boundary, or formatting constraint.
3. Read `references/system-prompt-guidance.md` before substantial rewrites or when the prompt has tool, source-selection, or multi-agent behavior.
4. Preserve product intent. Rewrite into house style. Extra tool calls or extra wrapping -> a scarce rule. A "don't overdo it" sentence beside a force-more rule loses.
5. Durable instructions stay in the system/developer prompt. Turn-specific facts, retrieved content, and user data stay outside it.
6. Remove contradictions, vague personality-only instructions, and rules that force unnecessary tool use.
7. Add examples only when they materially improve format, edge-case handling, or routing behavior.
8. Validate with the narrowest useful check: typecheck/build for code prompts, snapshot or unit tests for prompt contracts, and manual before/after reasoning for behavior-only changes.

## Prompt shape

Prefer this order for durable prompts:

1. Identity and mission.
2. Source and tool policy.
3. Decision rules and fallback behavior.
4. Output format and style constraints.
5. Safety, privacy, or hidden-instruction boundaries.
6. Short examples, only when needed.

Stable instructions first, for prompt caching where the API supports it.
Numbered or bulleted steps when order or completeness matters.
Delimiters or headings for mixed context, examples, and instructions.

## Review checklist

- Caveman speech, matching the live agent prompts.
- Scarce budget. Source priority explicit when more than one source can answer.
- Product constraints held.
- Hidden instructions, internal tool names, and raw provider errors stay off user-facing text.
- Inspect affected call sites and run the workflow checks.
