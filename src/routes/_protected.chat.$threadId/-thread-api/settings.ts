import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { dbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { settingsKeys } from "@/lib/query-keys";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    Kit.run(async () =>
      Kit.get(dbKit).run(async (db) => {
        const userSettings = await db.query.settings.findFirst({
          columns: { modelCapability: true },
          where: { userId: context.user.id },
        });

        return {
          modelCapability: userSettings?.modelCapability,
        };
      }),
    ).throws(() => toServerFnError.serverError("Failed to load settings")),
  );

export const settingsQuery = () =>
  queryOptions({
    queryFn: async () => getSettings(),
    queryKey: settingsKeys.all,
  });
