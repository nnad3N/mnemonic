import { useMutation, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";

import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";

import { createThreadTitle } from "../-thread-api/thread.functions";

type CreateThreadTitleVars = {
  threadId: string;
  text: string;
  topicId?: string;
};

export const useCreateThreadTitle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateThreadTitleVars) => createThreadTitle({ data }),
    onSuccess: (thread, vars) => {
      if (!thread) return;

      queryClient.setQueryData(sidebarQueries.threads(vars.topicId).queryKey, (current) =>
        produce(current, (draft) => {
          if (!draft) return;

          for (const item of draft) {
            if (item.id === thread.id) {
              item.title = thread.title;
              item.updatedAt = thread.updatedAt;
            }
          }
        }),
      );
    },
  });
};
