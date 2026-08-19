import type {
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  Processor,
} from "@mastra/core/processors";

const RESULT_IN_NEXT_MESSAGE = "Result follows in next message.";

/**
 * OpenAI takes media parts in a tool message; the providers behind other models reject them.
 * Matched after any gateway prefix, so `vercel/openai/...` counts too.
 */
const NATIVE_TOOL_MEDIA_MODEL_ID = /(^|\/)openai\//i;

/**
 * OpenAI-compatible providers (DeepInfra, Novita) type tool-message content as a plain string and
 * reject the media parts `readVisuals` and `readFile` return, whatever the model's own input
 * modalities say. Carrying that content in a user message right after the tool result works on
 * every provider.
 */
export const hoistToolResultMediaProcessor = {
  id: "hoist-tool-result-media",
  processLLMRequest({ model, prompt }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    if (NATIVE_TOOL_MEDIA_MODEL_ID.test(model.modelId)) {
      return;
    }

    const next: typeof prompt = [];
    let hoisted = false;

    for (const message of prompt) {
      if (message.role !== "tool") {
        next.push(message);
        continue;
      }

      const mediaParts = message.content.filter(
        (part) =>
          part.output.type === "content" &&
          part.output.value.some((value) => value.type === "media"),
      );

      if (mediaParts.length === 0) {
        next.push(message);
        continue;
      }

      hoisted = true;

      next.push(
        {
          ...message,
          content: message.content.map((part) =>
            mediaParts.includes(part)
              ? { ...part, output: { type: "text" as const, value: RESULT_IN_NEXT_MESSAGE } }
              : part,
          ),
        },
        {
          role: "user",
          content: mediaParts.flatMap((part) =>
            part.output.type === "content"
              ? part.output.value.map((value) =>
                  value.type === "media"
                    ? { type: "file" as const, data: value.data, mediaType: value.mediaType }
                    : value,
                )
              : [],
          ),
        },
      );
    }

    if (hoisted) {
      return { prompt: next };
    }
  },
} satisfies Processor;
