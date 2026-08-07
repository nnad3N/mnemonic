import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { dbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { DEFAULT_MODEL_CAPABILITY } from "@/lib/model-capability";

import { threadKeys } from "./query-keys";

export const getThreadSettings = createServerFn({ method: "GET" })
  .middleware([threadAccessMiddleware])
  .handler(async ({ context }) => {
    const settings = await Kit.run(async () =>
      Kit.get(dbKit).run((db) =>
        db.query.threadSettings.findFirst({
          columns: { modelCapability: true },
          where: { threadId: context.thread.id },
        }),
      ),
    ).throws(() => toServerFnError.serverError("Failed to load thread settings"));

    return {
      modelCapability: settings?.modelCapability ?? DEFAULT_MODEL_CAPABILITY,
    };
  });

export const threadSettingsQuery = (threadId: string) =>
  queryOptions({
    queryFn: async () => getThreadSettings({ data: { threadId } }),
    queryKey: threadKeys.settings(threadId),
  });
