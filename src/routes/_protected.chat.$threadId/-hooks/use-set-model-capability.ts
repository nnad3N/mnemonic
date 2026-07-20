import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

import { settings } from "@/db/schema";
import { dbKit } from "@/lib/db-kit";
import { Kit, toServerFnError } from "@/lib/kit";
import { authMiddleware } from "@/lib/middleware/auth-middleware";
import type { ModelCapability } from "@/lib/model-capability";
import { modelCapabilityLevels } from "@/lib/model-capability";

import { settingsQuery } from "../-thread-api/settings";

const updateModelCapabilitySchema = v.object({
  modelCapability: v.picklist(modelCapabilityLevels),
});

export const setModelCapability = createServerFn({ method: "POST" })
  .validator(updateModelCapabilitySchema)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await Kit.run(async () =>
      Kit.get(dbKit).run((db) =>
        db
          .insert(settings)
          .values({
            modelCapability: data.modelCapability,
            userId: context.user.id,
          })
          .onConflictDoUpdate({
            target: settings.userId,
            set: { modelCapability: data.modelCapability },
          }),
      ),
    ).throws(() => toServerFnError.serverError("Failed to save settings"));

    return { modelCapability: data.modelCapability };
  });

export const useSetModelCapability = () => {
  const queryClient = useQueryClient();
  const userSettingsQuery = settingsQuery();

  return useMutation({
    mutationFn: async (nextCapability: ModelCapability) =>
      setModelCapability({
        data: { modelCapability: nextCapability },
      }),
    onMutate: async (nextCapability) => {
      await queryClient.cancelQueries({
        queryKey: userSettingsQuery.queryKey,
      });

      const previousSettings = queryClient.getQueryData(userSettingsQuery.queryKey);

      queryClient.setQueryData(userSettingsQuery.queryKey, {
        modelCapability: nextCapability,
      });

      return { previousSettings };
    },
    onError: (_error, _nextCapability, context) => {
      queryClient.setQueryData(userSettingsQuery.queryKey, context?.previousSettings);
    },
    onSettled: async () =>
      queryClient.invalidateQueries({
        queryKey: userSettingsQuery.queryKey,
      }),
  });
};
