import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PlateController } from "platejs/react";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
} from "@/components/ui/message-scroller";
import { threadSettingsQuery } from "@/routes/_protected.chat.$threadId/-thread-api/settings";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";

export const Route = createFileRoute("/_protected/chat/$threadId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    await context.queryClient.prefetchQuery(threadSettingsQuery(params.threadId));
  },
});

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });

  return (
    <PlateController>
      <MessageScrollerProvider
        className="flex h-full min-h-0 w-full flex-1 flex-col"
        key={threadId}
      >
        <MessageScroller className="min-h-0 flex-1">
          <Outlet />
          <MessageScrollerButton />
        </MessageScroller>

        <div className="relative mx-auto flex w-full max-w-3xl justify-center px-2 pb-3">
          <ThreadComposer location="main" />
        </div>
      </MessageScrollerProvider>
    </PlateController>
  );
}
