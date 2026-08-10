import { createMiddleware } from "@tanstack/react-start";

import { isEmailAllowed } from "@/lib/better-auth/allowed-emails";
import { auth } from "@/lib/better-auth/auth";
import { toSafeId } from "@/lib/safe-id";

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  const authSession = await auth.api.getSession({
    headers: request.headers,
  });

  // The email check also locks out already-registered users after the
  // whitelist is tightened, not just new sign-ups.
  if (!authSession || !isEmailAllowed(authSession.user.email)) {
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
});
