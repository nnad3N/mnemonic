# Tool Description Guidance

## Project policy vs. official lab guidance

Official lab docs (sources below) recommend verbose descriptions covering when to use the tool, when not to, and what it returns, aiming for 3–4+ sentences. That guidance is written to also serve weak models. This project targets current frontier models and deliberately deviates: the model routes itself, so descriptions carry only what the tool does plus non-inferable caveats. Where the official docs and this file disagree, this file wins.

## Sources

- OpenAI API function calling: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI API prompt engineering: https://developers.openai.com/api/docs/guides/prompt-engineering
- Anthropic tool definition guidance: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
- Google Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Google Gemini prompt design strategies: https://ai.google.dev/gemini-api/docs/prompting-strategies

## Guidance

- Tool definitions are part of the model's prompt context, paid for on every request. Every sentence must earn its tokens.
- Only the name, description, and input schema reach the model. Output schemas are not sent; the model learns the output shape from the first result, so "returns …" enumeration is dead weight.
- Cross-tool routing is the model's job. If overlapping tools genuinely need a priority rule, it goes in the agent system prompt's source policy, never in a tool description.
- Per-parameter meaning, defaults, formats, and where to get values live on the Valibot input schema via `v.description(...)`, which surfaces in the JSON Schema. Omit the description when the field name and constraints suffice; never restate schema facts in the tool description.
- Keep schemas strict and aligned with runtime behavior: enums, variants, and required fields instead of weak strings.
- Assume a response can include zero, one, or multiple tool calls, including parallel calls.
- Consolidate related operations into one tool with a mode/action variant when separate tools would create selection ambiguity; separate them when permissions, side effects, or result contracts differ.
- Return high-signal, compact result data with stable identifiers. Bloated outputs make the next reasoning step harder.
- Backticks mark tokens the model must reproduce verbatim (identifiers, formats, code fragments) and nothing else.

## Red Flags

- Description tells the model when to call the tool, or names another tool.
- Description enumerates the fields the tool returns.
- Description repeats parameter defaults, formats, or ID-source rules that belong on `v.description` in the input schema.
- Hand-written enumeration of a shape that exists in code and can drift from it.
- Backticks as decoration on library names or ordinary prose.
- Schema has weak string fields where enums or constrained objects are expected.
- Description mentions capabilities the implementation does not have.
- Tool returns raw internal errors or provider payloads.
