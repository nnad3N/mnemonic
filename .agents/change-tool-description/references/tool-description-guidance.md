# Official 2026/Current Lab Guidance For Tool Descriptions

Use only official lab documentation or release notes for durable guidance. Do not use individual blog posts as authority. DeepSeek official function-calling docs were not used here because no 2026-dated official tool-description guidance was confirmed during research.

## Sources

- OpenAI API function calling: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI API prompt engineering: https://developers.openai.com/api/docs/guides/prompt-engineering
- Anthropic tool definition guidance: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
- Anthropic release notes showing 2026 current-model context: https://platform.claude.com/docs/en/release-notes/overview
- Google Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Google Gemini prompt design strategies: https://ai.google.dev/gemini-api/docs/prompting-strategies

## Shared Guidance

- Tool definitions are part of the model's prompt context. Treat descriptions as prompt text, not decorative metadata.
- Describe what the tool does, when to use it, when not to use it, what each parameter means, and caveats or limitations.
- Keep schemas strict and aligned with runtime behavior. OpenAI recommends strict schema adherence for reliable calls where supported.
- Assume a response can include zero, one, or multiple tool calls, including parallel calls where the model/framework supports them.
- Use examples for complex or format-sensitive inputs if the framework supports schema-validated examples.
- Consolidate related operations when separate tools would create selection ambiguity, but separate tools when permissions, side effects, or result contracts differ.
- Use meaningful namespacing when tools span multiple resources or services.
- Return high-signal, stable identifiers and compact result data. Avoid bloated tool outputs that make the next reasoning step harder.
- Clarify fallback paths between overlapping retrieval, search, raw file, and action tools.
- Keep system prompts and tool descriptions synchronized. Prompts should state high-level routing; tool descriptions should own precise usage details.

## Red Flags

- Description is a one-line label and does not say when to use the tool.
- Schema has weak string fields where IDs, enums, or constrained objects are expected.
- Prompt says to use one tool first, while the tool description says another tool is first.
- Tool returns raw internal errors or provider payloads.
- Multiple tools can answer the same user request with no priority rule.
- Description mentions capabilities the implementation does not have.
