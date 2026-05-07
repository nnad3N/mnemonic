import { createFileRoute } from "@tanstack/react-router";

import { auth } from "@/server/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      // oxlint-disable-next-line require-await
      GET: async ({ request }) => auth.handler(request),
      // oxlint-disable-next-line require-await
      POST: async ({ request }) => auth.handler(request),
    },
  },
});
