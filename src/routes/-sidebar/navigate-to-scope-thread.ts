import type { QueryClient } from "@tanstack/react-query";
import type { useNavigate } from "@tanstack/react-router";
import { produce } from "immer";
import { nanoid } from "nanoid";

import { sidebarThreadsQuery } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";

type Navigate = ReturnType<typeof useNavigate>;

type NavigateToScopeThreadInput = {
  navigate: Navigate;
  queryClient: QueryClient;
  topicId: string | undefined;
};

/** Land on the latest thread in a scope, or a new client id if the scope is empty. */
export const navigateToScopeThread = async ({
  navigate,
  queryClient,
  topicId,
}: NavigateToScopeThreadInput) => {
  const threads = await queryClient.ensureQueryData(sidebarThreadsQuery(topicId));
  const latest = threads.at(0);

  await navigate({
    params: { threadId: latest?.id ?? nanoid() },
    replace: true,
    search: (prev) =>
      produce(prev, (draft) => {
        draft.topic = topicId;
      }),
    to: "/chat/$threadId",
  });
};
