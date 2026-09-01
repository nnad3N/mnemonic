import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ModelOption } from "@/lib/model-option";

import {
  threadSettingsQueries,
  upsertThreadModelOption,
} from "../-thread-api/thread-settings.functions";

export const useUpsertModelOption = (threadId: string) => {
  const queryClient = useQueryClient();
  const settingsQuery = threadSettingsQueries.byThread(threadId);

  return useMutation({
    mutationFn: async (nextOption: ModelOption) =>
      upsertThreadModelOption({
        data: { modelOption: nextOption, threadId },
      }),
    onMutate: async (nextOption) => {
      await queryClient.cancelQueries({
        queryKey: settingsQuery.queryKey,
      });

      const previousSettings = queryClient.getQueryData(settingsQuery.queryKey);

      queryClient.setQueryData(settingsQuery.queryKey, {
        modelOption: nextOption,
      });

      return { previousSettings };
    },
    onError: (_error, _nextOption, context) => {
      queryClient.setQueryData(settingsQuery.queryKey, context?.previousSettings);
    },
    onSettled: async () =>
      queryClient.invalidateQueries({
        queryKey: settingsQuery.queryKey,
      }),
  });
};
