import { createMiddleware } from "@tanstack/react-start";

import { auth } from "@/server/auth";

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
        user: authSession.user,
      },
    });
  }
);
