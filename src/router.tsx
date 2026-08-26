import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { getContext } from "./lib/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

// Reached by both the client and the server entry, so one guard covers both. Safari has no
// stable Temporal yet; every other target takes the false branch and never fetches the chunk.
// oxlint-disable-next-line anti-slop/no-runtime-typeof
if (typeof Temporal === "undefined") {
  await import("temporal-polyfill/global");
}

export const getRouter = () => {
  const context = getContext();

  const router = createTanStackRouter({
    context,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultStructuralSharing: true,
    routeTree,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({ queryClient: context.queryClient, router });

  return router;
};

export type Router = ReturnType<typeof getRouter>;

declare module "@tanstack/react-router" {
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface Register {
    router: Router;
  }
}
