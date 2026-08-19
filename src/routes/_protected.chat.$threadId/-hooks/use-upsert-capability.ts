import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ModelCapability } from "@/lib/model-capability";

import {
  threadSettingsQueries,
  upsertThreadCapability,
} from "../-thread-api/thread-settings.functions";

export const useUpsertCapability = (threadId: string) => {
  const queryClient = useQueryClient();
  const settingsQuery = threadSettingsQueries.byThread(threadId);

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
