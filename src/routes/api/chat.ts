import { handleChatStream } from "@mastra/ai-sdk";
import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStreamResponse } from "ai";

import { mastra } from "@/mastra";
import { mnemonicAgentId } from "@/mastra/agents/mnemonic-agent";
import { authMiddleware } from "@/server/auth-middleware";

export const Route = createFileRoute("/api/chat")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request }) => {
        // oxlint-disable-next-line typescript/no-unsafe-assignment
        const params = await request.json();

        const stream = await handleChatStream({
          mastra,
          agentId: mnemonicAgentId,
          // oxlint-disable-next-line typescript/no-unsafe-assignment
          params,
          version: "v6",
        });

        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
