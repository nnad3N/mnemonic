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

    let stripped = false;

    const next = prompt.map((message) => {
      if (message.role !== "assistant") {
        return message;
      }

      const content = message.content.flatMap((part) => {
        if (part.type === "reasoning") {
          stripped = true;
          return [];
        }

        const openrouterOptions =
          part.type === "tool-call" ? part.providerOptions?.openrouter : undefined;

        if (!openrouterOptions || !("reasoning_details" in openrouterOptions)) {
          return part;
        }

        stripped = true;
        const { reasoning_details: _dropped, ...openrouter } = openrouterOptions;

        return { ...part, providerOptions: { ...part.providerOptions, openrouter } };
      });

      return { ...message, content };
    });

    if (stripped) {
      return { prompt: next };
    }
  },
} satisfies Processor;
