import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

import { threadSettings } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import type { ModelCapability } from "@/lib/model-capability";
import { modelCapabilityLevels } from "@/lib/model-capability";

import { threadSettingsQuery } from "../-thread-api/settings";

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

export const useUpsertCapability = (threadId: string) => {
  const queryClient = useQueryClient();
  const settingsQuery = threadSettingsQuery(threadId);

  return useMutation({
    mutationFn: async (nextCapability: ModelCapability) =>
      upsertThreadCapability({
        data: { modelCapability: nextCapability, threadId },
      }),
    onMutate: async (nextCapability) => {
      await queryClient.cancelQueries({
        queryKey: settingsQuery.queryKey,
      });

      const previousSettings = queryClient.getQueryData(settingsQuery.queryKey);

      queryClient.setQueryData(settingsQuery.queryKey, {
        modelCapability: nextCapability,
      });

      return { previousSettings };
    },
    onError: (_error, _nextCapability, context) => {
      queryClient.setQueryData(settingsQuery.queryKey, context?.previousSettings);
    },
    onSettled: async () =>
      queryClient.invalidateQueries({
        queryKey: settingsQuery.queryKey,
      }),
  });
};
