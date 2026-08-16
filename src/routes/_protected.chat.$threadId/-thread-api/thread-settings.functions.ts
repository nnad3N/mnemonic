import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

import { threadSettings } from "@/db/schema.server";
import { dbKit } from "@/lib/db-kit.server";
import { duration } from "@/lib/durations";
import { toServerFnError } from "@/lib/errors/server-fn-error";
import * as Kit from "@/lib/kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access.middleware";
import { DEFAULT_MODEL_CAPABILITY, modelCapabilityLevels } from "@/lib/model-capability";

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

const upsertCapabilitySchema = v.object({
  modelCapability: v.picklist(modelCapabilityLevels),
});

export const upsertThreadCapability = createServerFn({ method: "POST" })
  .validator(upsertCapabilitySchema)
  .middleware([threadAccessMiddleware])
  .handler(async ({ context, data }) => {
    await Kit.run(async () =>
      Kit.get(dbKit).run((db) =>
        db
          .insert(threadSettings)
          .values({
            modelCapability: data.modelCapability,
            threadId: context.thread.id,
            userId: context.user.id,
          })
          .onConflictDoUpdate({
            target: threadSettings.threadId,
            set: { modelCapability: data.modelCapability },
          }),
      ),
    ).throws(() => toServerFnError.serverError("Failed to save thread settings"));
  });

export const threadSettingsQueries = {
  all: () => ["thread-settings"] as const,
  byThread: (threadId: string) =>
    queryOptions({
      queryFn: async () => getThreadSettings({ data: { threadId } }),
      queryKey: [...threadSettingsQueries.all(), threadId] as const,
      staleTime: duration.FIVE.MINUTES,
    }),
};
