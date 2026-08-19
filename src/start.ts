import { createSerializationAdapter } from "@tanstack/react-router";
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { gtMiddleware } from "gt-tanstack-start";

import { ServerFnError } from "@/lib/errors/server-fn-error";

const serverFnErrorAdapter = createSerializationAdapter({
  key: "ServerFnError",
  test: (value) => ServerFnError.is(value),
  toSerializable: ({ message, status }) => ({ message, status }),
  fromSerializable: (value) => new ServerFnError(value),
});

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
  requestMiddleware: [csrfMiddleware, gtMiddleware],
  serializationAdapters: [serverFnErrorAdapter],
}));
