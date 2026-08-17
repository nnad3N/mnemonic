import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { produce } from "immer";
import { useEffect } from "react";

import { useChatStore } from "@/routes/-chat-store";
import { threadQueries } from "@/routes/_protected.chat.$threadId/-hooks/use-thread-chat";
import {
  markThreadViewed,
  threadRunQueries,
} from "@/routes/_protected.chat.$threadId/-thread-api/thread-run.functions";
import { ThreadMessages } from "@/routes/_protected.chat.$threadId/-thread-components/thread-messages";
import { FilesSync } from "@/routes/_protected.topic.$topicId/-topic-components/files-sync";

export const Route = createFileRoute("/_protected/chat/$threadId/")({
  // threadChatQuery holds a Chat class instance, which cannot be dehydrated.
  ssr: false,
  component: RouteComponent,
  loader: async ({ context, params }) => {
    await context.queryClient.prefetchQuery(threadQueries.chat(params.threadId));
  },
});

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(threadQueries.chat(threadId));
  const { data: runStatus } = useQuery({
    ...threadRunQueries.states(),
    select: (states) => states.find((state) => state.threadId === threadId)?.status,
  });

  const { mutate: markViewed } = useMutation({
    mutationFn: async () => markThreadViewed({ data: { threadId } }),
    onMutate: async () => {
      const queryKey = threadRunQueries.states().queryKey;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (states) =>
        produce(states, (draft) => {
          const state = draft?.find((entry) => entry.threadId === threadId);

          if (state) {
            state.viewedAt = new Date();
          }
        }),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(threadRunQueries.states().queryKey, context?.previous);
    },
  });

  // Also re-marks when a run settles while the thread is open, or its badge would light up.
  useEffect(() => {
    if (runStatus === "running") return;

    markViewed();
  }, [markViewed, runStatus]);

  useEffect(() => {
    useChatStore.getState().hydrateAttachments(threadId, data.chat.messages);
  }, [data.chat, threadId]);

  useEffect(() => {
    void data.chat.resumeStream();
  }, [data.chat]);

  return (
    <>
      {data.topicId && <FilesSync topicId={data.topicId} />}
      <ThreadMessages />
    </>
  );
}
