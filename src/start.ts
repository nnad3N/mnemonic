import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

import { ServerFnError } from "@/lib/kit";

const serverFnErrorLoggingMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, serverFnMeta }) => {
    try {
      return await next();
    } catch (error) {
      const logError = ServerFnError.is(error) && error.cause !== undefined ? error.cause : error;

      console.error(`${serverFnMeta.name} (${serverFnMeta.filename})`, "\n", logError);
      throw error;
    }
  },
);

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [serverFnErrorLoggingMiddleware],
  requestMiddleware: [csrfMiddleware],
}));
