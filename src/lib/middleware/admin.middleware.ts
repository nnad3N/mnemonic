import { createMiddleware } from "@tanstack/react-start";

import { authMiddleware } from "@/lib/middleware/auth.middleware";

import { toServerFnError } from "../errors/server-fn-error";

export const adminMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (context.user.role !== "admin") {
      throw toServerFnError.forbidden();
    }

    return next();
  });
