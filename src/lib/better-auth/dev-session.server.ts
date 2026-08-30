import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

import { user } from "@/db/auth-schema.server";
import { drizzleDb } from "@/db/client.server";

export const DEV_SESSION_URL_PATH = "/api/auth/dev/session";

export type DevSessionResolution<T> =
  | { type: "ok"; user: T }
  | { type: "no-user" }
  | { type: "many-users" };

export const resolveDevSessionUser = <T>(users: readonly T[]): DevSessionResolution<T> => {
  if (users.length > 1) {
    return { type: "many-users" };
  }

  const sole = users.at(0);

  if (sole === undefined) {
    return { type: "no-user" };
  }

  return { type: "ok", user: sole };
};

export const devSession = () => ({
  id: "dev-session",
  endpoints: {
    mintDevSession: createAuthEndpoint("/dev/session", { method: "GET" }, async (ctx) => {
      const users = await drizzleDb.select().from(user);
      const resolution = resolveDevSessionUser(users);

      switch (resolution.type) {
        case "no-user": {
          throw APIError.from("BAD_REQUEST", {
            code: "NO_USER",
            message: "Sign up once with a passkey before using the dev session.",
          });
        }
        case "many-users": {
          throw APIError.from("BAD_REQUEST", {
            code: "MANY_USERS",
            message: "Dev session needs exactly one user.",
          });
        }
        case "ok": {
          const session = await ctx.context.internalAdapter.createSession(resolution.user.id);
          await setSessionCookie(ctx, { session, user: resolution.user });
          // ctx.redirect("/") 302s without the Set-Cookie that setSessionCookie just wrote.
          ctx.responseHeaders.set("Location", "/");
          return new Response(null, { headers: ctx.responseHeaders, status: 302 });
        }
      }
    }),
  },
});
