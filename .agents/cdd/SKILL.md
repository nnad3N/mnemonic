---
name: cdd
description: Constraint-driven design. Outline and hard constraints from expand context.
disable-model-invocation: true
---

# Constraint-driven design

Turn `docs/<slug>/context.md` into a rough **outline** and the **hard constraints**. Types, callstack, data flow. How each piece gets built stays off the page so a pivot is cheap.

Read the files the context names and the callstack you are walking.

## Process

### 1. Open the pair

Need `docs/<slug>/context.md`. Use the path the user gave. If they didn't, ask.

Read it. That file is the want. Done when you can state the want in one sentence.

### 2. Walk the callstack

Short summary first: today's callstack, the one you want, and the delta.

Then every **layer** of both stacks: input type, output type, side effects, errors. Which types get added, changed, or removed.

When designing the data flow, call the Skill tool with "principle-type-system-discipline" and "principle-boundary-discipline". Types, where validation lives, and which errors each layer owns come from those skills.

Focus on code paths, abstractions, and data flow. The outline of the code, not a plan for writing it.

Write `docs/<slug>/outline.md` once both stacks exist. Update it as layers settle. Done when every layer has in, out, effects, and errors.

### 3. Constraints

Discuss what each layer **may** do and **may not**. Those are the hard constraints. Put them on the layer they bind.

Done when every layer has its may / may not, and the user has not rejected them.

### 4. Slices

If the whole outline fits in one review, stop. No list.

If it does not, add **slices**: ordered vertical cuts. The first slice is the narrowest path through the feature that can be tested end to end on its own. Each later slice adds onto that working path. One slice, one commit.

Done when the first slice is e2e-testable alone, and each later slice names what it adds.

This skill ends when `outline.md` matches the walkthrough. A later message that names a slice is implementation, not this skill.

## Outline shape

```md
# <want, one line>

## Callstack

Today: A → B → C
Wanted: A → B' → D

## Types

Add:
Change:
Remove:

## Layers

### <name>

In:
Out:
Effects:
Errors:
May:
May not:

## Slices
```

`## Slices` only when step 4 earned a list.
