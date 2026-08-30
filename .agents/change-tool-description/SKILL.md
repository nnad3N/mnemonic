---
name: change-tool-description
description: Mastra tool input copy and Valibot v.description. Use when creating, auditing, or refactoring LLM tool descriptions, names, parameter schemas, input examples, or tool-result contracts.
---

# Change Tool Description

## House style

Tool definitions are prompt text the model pays for on every request. Keep them minimal: state what the tool does and the caveats the model cannot infer, and trust the model to decide when to call it.

- Describe only the tool itself: what it does and how to use it. No "use when…" / "do not use when…" routing, and never mention another tool — tool choice belongs to the model, and any routing policy that must exist lives in the agent system prompt.
- Do not enumerate what the tool returns. The output schema is not sent to the model, and it sees the real output after the first call. Mention output only when it is the tool's essential function (e.g. "returns the page as markdown") or a caveat the model would misread (e.g. examples written in a non-JavaScript expression language).
- Never duplicate between the description string and the input schema. Per-parameter meaning, defaults, and where to get values go on the Valibot schema with `v.description(...)`; omit the description entirely when the field name, type, and constraints already say it.
- Backticks only around literal code tokens the model must reproduce exactly: identifiers (`env.file`), formats (`file::<value>`), code fragments (`export default <value>`). Plain prose for library names and concepts; JSON string values in double quotes ("file"), not backticks.
- When a description enumerates a shape that exists in code (accepted key types, object fields), build the string from the source of truth so it cannot drift: `mentionKeyFormat([...])` for mention keys, `Object.keys({...} satisfies Record<keyof T, true>)` for object fields.
- Input examples go in Mastra's `inputExamples` option on `createTool`, never in descriptions, and never with hardcoded real-looking IDs.
- Leave obvious reactions unsaid: the model retries on error results, reads what comes back, and infers standard field meanings.

## Workflow

1. Locate the tool definition, runtime handler, schema, result shaping, and every system prompt that mentions the tool.
2. Read `references/tool-description-guidance.md` when reworking several tools or when the policy itself is in question.
3. Verify what the tool actually does from the implementation, not from its current description.
4. Rewrite to the house style above: move parameter details onto the schema, delete routing, returns prose, and anything inferable.
5. Keep the schema tight: meaningful field names, enum/variant constraints, required fields, no unused fields.
6. Shape tool results to include only high-signal data the model needs for the next step.
7. Update agent prompts if they duplicate or contradict the tool description; source routing stays in the prompt's source policy.
8. Validate with typecheck and existing tests.

## Review Checklist

- Description says what the tool does — nothing about when to call it, and no other tool named.
- No sentence restates something visible in the schema, the field names, or the tool's output.
- No "Returns …" enumeration of output fields.
- Backticks appear only around verbatim code tokens.
- Shape enumerations are constructed from types, not hand-written.
- Description and schema match runtime behavior exactly.
- Error outputs are safe for the model; raw provider internals are not surfaced.
