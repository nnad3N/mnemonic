---
name: expand
description: Grow a seed into context for constraint-driven design.
disable-model-invocation: true
---

# Expand

Grow a seed into what the user wants. Interview with **grilling**. Look up facts. Keep a living draft at `docs/<slug>/context.md` for **cdd**.

## Process

### 1. Name the folder

Pick a kebab-case `slug` from the seed. Use the user's name when they gave one. If two names fit, ask.

Write `docs/<slug>/context.md` now, from whatever the seed already states. Empty sections can wait. Done when the file exists.

### 2. Expand in rounds

Call the Skill tool with "grilling". Steer every round:

- The tree is the *want*: what they want, the problem it solves, scope, and any decision that would change the want.
- Grow the seed. Offer a sharper reading of what they might want, then wait.
- Facts are yours. Repo facts when the question is how this codebase works. Web facts when the question is which data structure, algorithm, or package. Put the finding under Facts, with a path or URL. The choice stays with the user.

After each round, before the next, update `context.md` so it matches every settled decision and fact. Drop sections that are still empty. Done when the frontier is empty and the file matches.

### 3. Hand off

The draft is the context. Stop. **cdd** starts in a new thread, pointed at this folder.

## Draft shape

```md
# <want, one line>

## Want

## Problem

## Decisions

## Facts

## Out of scope

## Open
```

Decisions are choices the user made. How to build them is **cdd**.
