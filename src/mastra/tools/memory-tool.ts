import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

export const memoryTool = createTool({
  id: "memory-helper",
  description: "Generate a concise mnemonic for a topic or fact.",
  inputSchema: toStandardJsonSchema(
    v.object({
      subject: v.pipe(v.string(), v.nonEmpty("Provide a subject to remember.")),
    })
  ),
  outputSchema: toStandardJsonSchema(
    v.object({
      mnemonic: v.string(),
    })
  ),
  // oxlint-disable-next-line require-await
  execute: async ({ subject }) => {
    const firstLetters = subject
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.at(0)?.toUpperCase() ?? "")
      .join("");

    return {
      mnemonic: `${firstLetters}: ${subject}`,
    };
  },
});
