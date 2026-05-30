import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PlateController } from "platejs/react";

import { Spinner } from "@/components/ui/spinner";
import { ThreadChatProvider } from "@/routes/_protected.chat.$threadId/-thread-chat-context";

export const Route = createFileRoute("/_protected/chat/$threadId")({
  component: RouteComponent,
  pendingComponent: () => (
    <div className="flex h-full min-h-0 flex-col items-center justify-center">
      <Spinner className="size-10" />
    </div>
  ),
});

/* oxlint-disable func-style */
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
