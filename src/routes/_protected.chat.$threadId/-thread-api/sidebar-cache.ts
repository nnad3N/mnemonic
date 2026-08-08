import type { QueryClient } from "@tanstack/react-query";
import { produce } from "immer";

import {
  sidebarConversationsQuery,
  sidebarTopicsQuery,
  sidebarTopicThreadsQuery,
} from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";
import type { SidebarThread } from "@/routes/_protected.chat.$threadId/-thread-api/types";

const takeThread = (pages: { items: SidebarThread[] }[], threadId: string) => {
  for (const page of pages) {
    const threadIndex = page.items.findIndex((item) => item.id === threadId);

    if (threadIndex !== -1) {
      return page.items.splice(threadIndex, 1).at(0);
    }
  }
};

const moveThreadToTop = (
  pages: { items: SidebarThread[] }[],
  threadId: string,
  updatedAt: string,
) => {
  const thread = takeThread(pages, threadId);
  const firstPage = pages.at(0);

  if (!thread || !firstPage) return;

  thread.updatedAt = updatedAt;
  firstPage.items.unshift(thread);
};

type MoveSidebarThreadToTopInput = {
  threadId: string;
  topicId: string | undefined;
};

export const moveSidebarThreadToTop = (
  queryClient: QueryClient,
  input: MoveSidebarThreadToTopInput,
) => {
  const updatedAt = Temporal.Now.instant().toString();

  if (!input.topicId) {
    queryClient.setQueryData(sidebarConversationsQuery().queryKey, (current) =>
      produce(current, (draft) => {
        if (!draft) return;

        moveThreadToTop(draft.pages, input.threadId, updatedAt);
      }),
    );

    return;
  }

  queryClient.setQueryData(sidebarTopicThreadsQuery(input.topicId).queryKey, (current) =>
    produce(current, (draft) => {
      if (!draft) return;

      moveThreadToTop(draft.pages, input.threadId, updatedAt);
    }),
  );

  queryClient.setQueryData(sidebarTopicsQuery().queryKey, (current) =>
    produce(current, (draft) => {
      if (!draft) return;

      for (const page of draft.pages) {
        for (const topic of page.items) {
          if (topic.id === input.topicId) {
            moveThreadToTop([{ items: topic.threads }], input.threadId, updatedAt);
          }
        }
      }
    }),
  );
};
