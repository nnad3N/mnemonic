import { createFileRoute } from "@tanstack/react-router";
import { Result } from "better-result";

import { durableAgentsKit } from "@/lib/durable-agents-kit.server";
import * as Kit from "@/lib/kit";
import { authMiddleware } from "@/lib/middleware/auth.middleware";

// Proxies drop idle connections; the browser then reconnects, and the sidebar refetches every time.
const HEARTBEAT_MS = 30 * 1000;

export const Route = createFileRoute("/api/run-events")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: ({ context }) => {
        const encoder = new TextEncoder();
        let heartbeat: NodeJS.Timeout | undefined;
        let unsubscribe: (() => Promise<unknown>) | undefined;

        const stream = new ReadableStream({
          start: async (controller) => {
            const subscribed = await Kit.get(durableAgentsKit).subscribeRunEvents({
              onEvent: (event) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              },
              userId: context.user.id,
            });

            // A broken body makes `EventSource` reconnect; a non-200 status would make it give up.
            if (Result.isError(subscribed)) {
              controller.error(subscribed.error);
              return;
            }

            unsubscribe = subscribed.value;
            heartbeat = setInterval(() => {
              controller.enqueue(encoder.encode(": ping\n\n"));
            }, HEARTBEAT_MS);
          },
          cancel: async () => {
            clearInterval(heartbeat);
            await unsubscribe?.();
          },
        });

        return new Response(stream, {
          headers: { "Cache-Control": "no-cache", "Content-Type": "text/event-stream" },
        });
      },
    },
  },
});
