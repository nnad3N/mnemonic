import { createMiddleware } from "@tanstack/react-start";

import { auth } from "@/lib/better-auth/auth";
import { toSafeId } from "@/lib/safe-id";

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const authSession = await auth.api.getSession({
      headers: request.headers,
    });

    if (authSession === null) {
      return new Response("Forbidden", { status: 403 });
    }

    return next({
      context: {
        session: authSession.session,
        user: {
          ...authSession.user,
          // oxlint-disable-next-line eslint-js/no-restricted-syntax -- trusted auth session.
          id: toSafeId<"user">(authSession.user.id),
        },
      },
    });
  }
);
