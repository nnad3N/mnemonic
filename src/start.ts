import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";

const serverFnErrorLoggingMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, serverFnMeta }) => {
    try {
      return await next();
    } catch (error) {
      console.error(`${serverFnMeta.name} (${serverFnMeta.filename})`, "\n", error);
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
