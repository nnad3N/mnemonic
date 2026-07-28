import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PlateController } from "platejs/react";
import { useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useChatStore } from "@/routes/-chat-store";
import { threadChatQuery } from "@/routes/_protected.chat.$threadId/-hooks/use-thread-chat";
import { FilesSync } from "@/routes/_protected.topic.$topicId/-topic-components/files-sync";

export const Route = createFileRoute("/_protected/chat/$threadId")({
  ssr: false,
  component: RouteComponent,
  loader: async ({ context, params }) => {
    await context.queryClient.prefetchQuery(threadChatQuery(params.threadId));
  },
  pendingMs: 0,
  pendingComponent: () => (
    <div className="flex h-full min-h-0 flex-col items-center justify-center">
      <Spinner className="size-10" />
    </div>
  ),
});

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });
  const { data } = useSuspenseQuery(threadChatQuery(threadId));

  useEffect(() => {
    useChatStore.getState().hydrateAttachments(threadId, data.chat.messages);
  }, [data.chat, threadId]);

  return (
    <>
      {data.topicId && <FilesSync topicId={data.topicId} />}
      <PlateController>
        <div className="flex h-full min-h-0 flex-col">
          <Outlet />
        </div>
      </PlateController>
    </>
  );
}
