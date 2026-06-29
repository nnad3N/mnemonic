import { webSearch } from "@exalabs/ai-sdk";

import { env } from "@/env";

export const webSearchTool = webSearch({
  apiKey: env.EXA_API_KEY,
  type: "auto",
  contents: {
    highlights: false,
  },
});
