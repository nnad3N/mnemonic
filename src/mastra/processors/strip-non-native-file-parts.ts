import type {
  ProcessLLMRequestArgs,
  ProcessLLMRequestResult,
  Processor,
} from "@mastra/core/processors";

import { isLLMNativeMimeType } from "@/lib/file-validation";

export const stripNonNativeFilePartsProcessor = {
  id: "strip-non-native-file-parts",
  processLLMRequest({ prompt }: ProcessLLMRequestArgs): ProcessLLMRequestResult {
    return {
      prompt: prompt.map((message) => {
        if (message.role !== "user") {
          return message;
        }

        const content = message.content.filter(
          (part) => part.type !== "file" || isLLMNativeMimeType(part.mediaType),
        );

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
