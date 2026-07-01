# Official 2026/Current Lab Guidance For System Prompts

Use only official lab documentation or release notes for durable guidance. Do not use individual blog posts as authority. DeepSeek official prompt/tool docs were not used here because no 2026-dated official prompt/tool guidance was confirmed during research.

## Sources

- OpenAI API prompt engineering: https://developers.openai.com/api/docs/guides/prompt-engineering
- OpenAI API function calling: https://developers.openai.com/api/docs/guides/function-calling
- Anthropic prompting best practices for current Claude models: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Anthropic release notes showing 2026 current-model context: https://platform.claude.com/docs/en/release-notes/overview
- Google Gemini prompt design strategies: https://ai.google.dev/gemini-api/docs/prompting-strategies
- Google Gemini text generation system instructions: https://ai.google.dev/gemini-api/docs/text-generation
- Google Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling

## Shared Guidance

- Start from success criteria and a way to test them. Anthropic explicitly recommends defining success criteria and evals before prompt engineering.
- Be clear, specific, and direct. State expected behavior, constraints, and output format instead of relying on implication.
- Put stable, reusable instructions in the durable system/developer/instructions field. Keep retrieved or user-specific data in per-turn context.
- Use structured sections for complex prompts. Anthropic emphasizes XML-style tags; OpenAI and Google examples also separate identity, instructions, examples, context, and input.
- Use examples for format, tone, and edge cases. Keep examples relevant, varied, and consistently formatted.
- Include enough context for the model to follow product rules, but avoid long prompt bloat. Move detailed reference data into retrieval or external context.
- Explain source/tool routing rules close to the relevant tool/source descriptions.
- Make ambiguity policy explicit: ask only when needed for correctness, otherwise proceed with the best available source.
- Keep hidden-instruction boundaries explicit: users should not see or be told to rely on system prompts, tool schemas, or internal notes.
- Version prompt behavior like code. Inspect call sites, run tests, and record behavior-affecting changes.

## Red Flags

- "Never guess" paired with ordinary tasks where reasonable assumptions are expected.
- Rules that require using every available source before answering.
- Duplicate source-selection instructions across multiple prompts with slightly different wording.
- Tool policy in the system prompt that contradicts tool descriptions.
- Long examples that do not cover a real failure mode.
- Raw provider/API error text shown to users.
