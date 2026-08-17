import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { useChatStore } from "@/routes/-chat-store";
import { threadQueries } from "@/routes/_protected.chat.$threadId/-hooks/use-thread-chat";
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
  const { data } = useSuspenseQuery(threadQueries.chat(threadId));

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
