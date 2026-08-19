import type {
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  Processor,
} from "@mastra/core/processors";

export const stripFilePartsProcessor = {
  id: "strip-file-parts",
  processLLMRequest({ prompt }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    return {
      prompt: prompt.map((message) => {
        if (message.role !== "user") {
          return message;
        }

        const content = message.content.filter((part) => part.type !== "file");

        if (content.length === message.content.length) {
          return message;
        }

        return {
          ...message,
          content,
        };
      }),
    };
  },
} satisfies Processor;
