---
name: change-tool-description
description: Create, audit, or refactor LLM tool descriptions, names, parameter schemas, input examples, and tool-result contracts using official 2026/current AI-lab guidance. Use when Codex or Cursor needs to improve function calling reliability, reduce tool-selection ambiguity, clarify when a tool should or should not be used, or align tool docs with schemas and runtime behavior.
---

# Change Tool Description

## Workflow

1. Locate the tool definition, runtime handler, schema, result shaping, and every system prompt that mentions the tool.
2. Read `references/tool-description-guidance.md` before substantial rewrites or when multiple tools overlap.
3. Verify what the tool actually does from implementation, not from its current description.
4. Rewrite the description to cover purpose, when to use it, when not to use it, inputs, outputs, caveats, and fallback behavior.
5. Keep the schema tight: meaningful field names, parameter descriptions where the framework supports them, enum constraints, required fields, and no unused fields.
6. Prefer fewer, clearer tools over many overlapping tools unless the product needs separate actions or permissions.
7. Shape tool results to include only high-signal data the model needs for the next step.
8. Update nearby prompts when they duplicate or contradict the tool description.
9. Validate with typecheck/build and, where possible, tests or manual scenarios that exercise tool selection.

## Description Template

Use this template as prose, not as a rigid block:

1. What the tool does.
2. When to use it.
3. When not to use it.
4. What each input means and where to get it.
5. What the tool returns and what it does not return.
6. Caveats, limits, permissions, or required follow-up.
7. Fallback to try when this tool is insufficient.

## Review Checklist

- Tool name is specific, stable, and unambiguous.
- Description is detailed enough for selection without reading code.
- Description and schema agree with runtime validation.
- Overlapping tools have explicit routing rules.
- Dangerous or costly tools state limits and confirmation requirements.
- Error outputs are safe for the model and user; raw provider internals are not surfaced.
- Result payloads avoid context bloat and include stable identifiers.
- System prompts defer to tool descriptions instead of repeating every detail.
