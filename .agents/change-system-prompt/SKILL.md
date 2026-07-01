---
name: change-system-prompt
description: Refactor durable LLM system, developer, instruction, or agent prompts using official 2026/current AI-lab guidance. Use when Codex or Cursor needs to create, review, split, migrate, tighten, or test prompts that control assistant identity, role, source use, tool policy, output style, refusal/error behavior, or task workflow.
---

# Change System Prompt

## Workflow

1. Locate every prompt surface that can affect the behavior: system/developer messages, agent `instructions`, model `system` fields, reusable base prompts, prompt templates, and prompt snippets stored in config.
2. Identify the prompt's job: role, product behavior, source policy, tool policy, output contract, safety boundary, or formatting constraint.
3. Read `references/system-prompt-guidance.md` before substantial rewrites or when the prompt has tool, source-selection, or multi-agent behavior.
4. Preserve product intent. Rewrite for clarity, ordering, specificity, and testability before changing behavior.
5. Keep durable instructions in the system/developer prompt. Keep turn-specific facts, retrieved content, and user data outside the durable prompt.
6. Remove contradictions, vague personality-only instructions, and rules that force unnecessary questions or tools.
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

- State what the agent should do, when to do it, and when not to do it.
- Make source priority explicit when multiple sources can answer.
- Tell the agent when to ask a clarifying question and when to proceed.
- Use numbered or bulleted steps when order or completeness matters.
- Use delimiters or headings for mixed context, examples, and instructions.
- Avoid leaking hidden instructions, internal tool names, or raw provider errors to users.
- Keep reusable, stable instructions near the beginning for prompt caching where the API supports it.
- Treat prompt changes like code changes: inspect affected call sites and run available checks.
