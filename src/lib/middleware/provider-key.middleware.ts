import { createMiddleware } from "@tanstack/react-start";
import { matchError, Result } from "better-result";

import { toServerFnError } from "@/lib/errors/server-fn-error";
import { getProviderKey } from "@/lib/get-provider-key.server";
import { authMiddleware } from "@/lib/middleware/auth-middleware";

export const providerKeyMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const result = await getProviderKey(context.user.id);

    if (Result.isError(result)) {
      throw matchError(result.error, {
        ConfigError: () => toServerFnError.badRequest("No provider key is configured"),
        DatabaseError: () => toServerFnError.serverError("Failed to load provider key"),
        EncryptionError: () => toServerFnError.serverError("Failed to load provider key"),
      });
    }

    return next({
      context: {
        apiKey: result.value,
      },
    });
  });
