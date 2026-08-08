# Mnemonic

Mnemonic is under active development, and some of the core features are not implemented yet.

## What Mnemonic is trying to be

Mnemonic is meant to be a minimal research tool with good primitives that stay out of your way.

It is not trying to be groundbreaking. It is trying to be useful.

Mnemonic is built for individuals. It runs on libSQL, so an you can host it wherever you want.

Things like teams, shared workspaces or BYOK are all possible later if there is a reason to build them, but none of that is a priority right now.

## Why I am building it

Current AI tools just output too much text, and there is no good built-in continuation into chats. Carrying context forward feels awkward.

Starting over with a new thread often feels faster than explaining the existing context to an agent.

Companies are putting a lot of focus into coding tools, but I think there is still an empty niche around research tools that can output high-quality data.

## The direction

I am a big Cursor user, and I will defend their UI/UX forever. That is why Mnemonic takes the parts of Cursor's experience that I find "clean".

The tech stack is mostly made of tools I am already familiar with. Mastra is the main exception. I am using it because it makes agents easy to implement.

Every feature is one more thing to keep working, and a tool that tries to cover everything ends up doing none of it well. So the list of what Mnemonic will never do is long, and it is meant to be.

I hope that by having a narrow but flexible feature set, I can focus on the primitives and deliver a great tool. If that means Mnemonic is not the right tool for you, that is a fine outcome — use something that fits better.

This project is not vibe-coded, and I am putting real engineering effort into it. This doesn't mean that I don't use AI at all, it just means that I still care about the craft.

## Status

Mnemonic is in **alpha**.

Alpha means the chat works and I am happy with where it is going. It is not finished, but I cannot think of another big feature that would meaningfully improve how it feels to use. Everything around the chat is still unfinished.

For **local self-hosting** (Docker; OpenRouter API key required), see [docs/self-hosting.md](docs/self-hosting.md). Deployment docs are local-only for now — not a production guide.

## Roadmap

There are no dates here. The phases say how settled the project is, not when things land.

**Beta** is about turning a good chat into an app that feels whole. The main part is letting the work you do in a thread become something you keep — notes you own, tied to the subject they are about, instead of context that disappears when the thread does. The rest is everything around it: navigation, search, your account and settings, and the polish that makes it all feel finished. Reaching beta does not mean the end of breaking changes. It means the direction is set.

**v1** marks the stable phase. After that, no breaking changes without a migration guide.

Past that I keep a list of ideas — better ways to research and dig into sources, notes improvements, autocomplete. Some will land in beta, some after v1.
