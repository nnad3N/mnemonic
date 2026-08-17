import { createMiddleware } from "@tanstack/react-start";
import { matchError, Result } from "better-result";

import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { authMiddleware } from "@/lib/middleware/auth.middleware";
import { resolveProviderKey } from "@/lib/middleware/resolve-provider-key.server";

import { dbKit } from "../db-kit.server";

const providerKeyCtx = Kit.createContext(dbKit);

export const providerKeyMiddleware = createMiddleware()
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    const result = await resolveProviderKey(providerKeyCtx, context.user.id);

    if (Result.isError(result)) {
      throw matchError(result.error, {
        ProviderKeyNotFoundError: () => toServerFnError.badRequest("No provider key is configured"),
        DatabaseError: () => toServerFnError.serverError("Failed to load provider key"),
        EncryptionError: () => toServerFnError.serverError("Failed to load provider key"),
      });
    }

    return next({
      context: {
        apiKey: result.value.key,
      },
    });
  });
