import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PlateController } from "platejs/react";

import { Spinner } from "@/components/ui/spinner";
import { threadQuery } from "@/routes/_protected.chat.$threadId/-thread-api/get-thread";
import { ThreadChatProvider } from "@/routes/_protected.chat.$threadId/-thread-chat-provider";

export const Route = createFileRoute("/_protected/chat/$threadId")({
  component: RouteComponent,
  loader: async ({ context, params }) =>
    context.queryClient.ensureQueryData(threadQuery(params.threadId)),
  pendingMs: 0,
  pendingComponent: () => (
    <div className="flex h-full min-h-0 flex-col items-center justify-center">
      <Spinner className="size-10" />
    </div>
  ),
});

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });

  return (
    <ThreadChatProvider key={threadId} threadId={threadId}>
      <PlateController>
        <div className="flex h-full min-h-0 flex-col">
          <Outlet />
        </div>
      </PlateController>
    </ThreadChatProvider>
  );
}
