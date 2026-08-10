import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gt } from "drizzle-orm";

import { session } from "@/db/auth-schema";
import { dbKit } from "@/lib/db-kit";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { authKeys } from "@/routes/_auth/-auth.api";

// Better Auth's `/list-sessions` is gated by its freshness check and 403s once a
// session is older than `freshAge`. See better-auth#8175.
const listSessions = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      Kit.get(dbKit).run((db) =>
        db
          .select({
            createdAt: session.createdAt,
            id: session.id,
            ipAddress: session.ipAddress,
            token: session.token,
            updatedAt: session.updatedAt,
            userAgent: session.userAgent,
          })
          .from(session)
          .where(and(eq(session.userId, context.user.id), gt(session.expiresAt, new Date())))
          .orderBy(desc(session.updatedAt)),
      ),
    ).throws(() => toServerFnError.serverError("Failed to list sessions")),
  );

export type SessionItem = {
  createdAt: Date;
  id: string;
  ipAddress: string | null;
  token: string;
  updatedAt: Date;
  userAgent: string | null;
};

export const sessionsQuery = queryOptions({
  queryFn: async () => listSessions(),
  queryKey: authKeys.sessions(),
});
