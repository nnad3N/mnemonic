---
name: cdd
description: Constraint-driven design. Feature constraints, a type-driven outline, and design by contract, from expand context.
disable-model-invocation: true
---

# Constraint-driven design

**Constraints** on what the feature may and may not do, a **type-driven** outline, and **design by contract** on each layer. How each piece gets built stays off the page so a pivot is cheap. **Slices** only when the outline is too big for one review.

Read the files the context names and the callstack you are walking.

## Process

### 1. Open the pair

Need `docs/<slug>/context.md`. Use the path the user gave. If they didn't, ask.

Read it. That file is the want. Done when you can state the want in one sentence.

### 2. Walk the callstack

This is the type-driven half. Short summary first: today's callstack, the one you want, and the delta.

Then every **layer** of both stacks: input type, output type, side effects, errors. Which types get added, changed, or removed.

When designing the data flow, call the Skill tool with "principle-type-system-discipline" and "principle-boundary-discipline". Types, where validation lives, and which errors each layer owns come from those skills.

Focus on code paths, abstractions, and data flow. The outline of the code, not a plan for writing it.

Write `docs/<slug>/outline.md` once both stacks exist. Update it as layers settle. Done when every layer has in, out, effects, and errors.

### 3. Constraints

What the **feature** may do and may not. Not a per-function contract. Feature-level rules that collapse the design: cases real callers cannot produce leave the types and the callstack. They are absent, not handled.

A constraint that settles one case often settles another. Write those implied constraints down too.

If a constraint appears while walking, capture it here and cut the paths it forbids. Revisit the callstack and the types until they only cover what the constraints still allow.

Done when every constraint is a feature-level may or may not, the implied ones are written, and no layer still handles a forbidden case.

### 4. Contract

This is the design-by-contract half, on the layers that remain. Each layer is a contract between caller and callee:

- **Precondition**: what the caller owes. The layer may assume it.
- **Postcondition**: what the layer owes if the precondition held. Out, effects, and the errors it owns.
- **Invariant**: what stays true across calls.

The feature constraints are the rules every layer follows. The contract is how that layer states them.

Done when every remaining layer has precondition, postcondition, and invariant, and the user has not rejected them.

### 5. Slices

If the whole outline fits in one review, stop. No list.

If it does not, add **slices**: ordered vertical cuts. The first slice is the narrowest path through the feature that can be tested end to end on its own. Each later slice adds onto that working path. One slice, one commit.

Done when the first slice is e2e-testable alone, and each later slice names what it adds.

This skill ends when `outline.md` matches the walkthrough. A later message that names a slice is implementation, not this skill.

## Outline shape

```md
# <want, one line>

## Constraints

May:
May not:

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
Precondition:
Postcondition:
Invariant:

## Slices
```

`## Slices` only when step 5 earned a list.
