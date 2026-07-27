import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { dbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import { settingsKeys } from "@/lib/query-keys";

export const getSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userSettings = await Kit.run(async () =>
      Kit.get(dbKit).run((db) =>
        db.query.settings.findFirst({
          columns: { modelCapability: true },
          where: { userId: context.user.id },
        }),
      ),
    ).throws(() => toServerFnError.serverError("Failed to load settings"));

    if (!userSettings) {
      throw toServerFnError.notFound();
    }

    return {
      modelCapability: userSettings.modelCapability,
    };
  });

export const settingsQuery = () =>
  queryOptions({
    queryFn: async () => getSettings(),
    queryKey: settingsKeys.all,
  });
