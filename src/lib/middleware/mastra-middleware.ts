import { createMiddleware } from "@tanstack/react-start";

import { mastra } from "@/mastra";

export const mastraMiddleware = createMiddleware().server(async ({ next }) => {
  const store = await mastra.getStorage()?.getStore("memory");

  if (store === undefined) {
    return new Response("Internal server error", { status: 500 });
  }

  return next({
    context: {
      store,
    },
  });
});
