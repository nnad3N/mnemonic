---
name: change-tool-description
description: Create, audit, or refactor LLM tool descriptions, names, parameter schemas, input examples, and tool-result contracts using official 2026/current AI-lab guidance. Use when Codex or Cursor needs to improve function calling reliability, reduce tool-selection ambiguity, clarify when a tool should or should not be used, or align tool docs with schemas and runtime behavior.
---

# Change Tool Description

## Workflow

1. Locate the tool definition, runtime handler, schema, result shaping, and every system prompt that mentions the tool.
2. Read `references/tool-description-guidance.md` before substantial rewrites or when multiple tools overlap.
3. Verify what the tool actually does from implementation, not from its current description.
4. Rewrite the tool-level description to cover purpose, when to use it, when not to use it, outputs, caveats, and fallback behavior.
5. Put per-parameter docs on the Valibot input schema with `v.description(...)` (defaults, formats, where to get IDs). Do not repeat those details in the tool description.
6. Keep the schema tight: meaningful field names, `v.description` on inputs, enum constraints, required fields, and no unused fields.
7. Prefer fewer, clearer tools over many overlapping tools unless the product needs separate actions or permissions.
8. Shape tool results to include only high-signal data the model needs for the next step.
9. Update nearby prompts when they duplicate or contradict the tool description.
10. Validate with typecheck/build and, where possible, tests or manual scenarios that exercise tool selection.

## Description Template

Use this template as prose, not as a rigid block:

1. What the tool does.
2. When to use it.
3. When not to use it.
4. What the tool returns and what it does not return.
5. Caveats, permissions, or required follow-up (tool-level only — not per-field defaults or formats).
6. Fallback to try when this tool is insufficient.

## Input schema descriptions

For each input field, attach meaning with Valibot `v.description` in the pipe (after constraints):

```ts
limit: v.optional(
  v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(25),
    v.description("Maximum number of results to return. Defaults to 10."),
  ),
),
```

Do not put "Input X should be…" / default / format / ID-source prose in the tool `description` string when the field exists on the Valibot input schema.

## Review Checklist

- Tool name is specific, stable, and unambiguous.
- Description is detailed enough for selection without reading code.
- Per-parameter meaning, defaults, and formats live on the schema via `v.description`, not in the tool description.
- Description and schema agree with runtime validation.
- Overlapping tools have explicit routing rules.
- Dangerous or costly tools state limits and confirmation requirements.
- Error outputs are safe for the model and user; raw provider internals are not surfaced.
- Result payloads avoid context bloat and include stable identifiers.
- System prompts defer to tool descriptions instead of repeating every detail.
