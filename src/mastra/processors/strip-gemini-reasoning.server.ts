import type {
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  Processor,
} from "@mastra/core/processors";

const GEMINI_MODEL_ID = /(^|\/)google\/gemini/i;

/**
 * Gemini signs its thoughts and answers `Corrupted thought signature` when one comes back altered.
 * The OpenRouter provider validates Anthropic-format reasoning details only and forwards
 * `google-gemini-v1` ones unchecked, so a signature mangled in storage or streaming reaches Google
 * and fails the turn. https://github.com/OpenRouterTeam/ai-sdk-provider/issues/418
 *
 * Reasoning details also ride on tool-call parts, which the provider reads before reasoning parts.
 */
export const stripGeminiReasoningProcessor = {
  id: "strip-gemini-reasoning",
  processLLMRequest({ model, prompt }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    if (!GEMINI_MODEL_ID.test(model.modelId)) {
      return;
    }

    const next: typeof prompt = [];
    let stripped = false;

    for (const message of prompt) {
      if (message.role !== "assistant") {
        next.push(message);
        continue;
      }

      const content: typeof message.content = [];

      for (const part of message.content) {
        if (part.type === "reasoning") {
          stripped = true;
          continue;
        }

        const openrouterOptions =
          part.type === "tool-call" ? part.providerOptions?.openrouter : undefined;

        if (!openrouterOptions || !("reasoning_details" in openrouterOptions)) {
          content.push(part);
          continue;
        }

        stripped = true;
        const { reasoning_details: _dropped, ...openrouter } = openrouterOptions;

        content.push({ ...part, providerOptions: { ...part.providerOptions, openrouter } });
      }

      next.push({ ...message, content });
    }

    if (stripped) {
      return { prompt: next };
    }
  },
} satisfies Processor;
