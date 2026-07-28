import { createFileRoute } from "@tanstack/react-router";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
} from "@/components/ui/message-scroller";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";
import { ThreadMessages } from "@/routes/_protected.chat.$threadId/-thread-components/thread-messages";

export const Route = createFileRoute("/_protected/chat/$threadId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end" key={threadId}>
      <div className="typeset typeset-chat flex h-full min-h-0 w-full flex-col p-3">
        <MessageScroller className="min-h-0 flex-1">
          <ThreadMessages />
          <MessageScrollerButton />
        </MessageScroller>

        <div className="relative mx-auto flex w-full max-w-3xl justify-center">
          <ThreadComposer location="main" />
        </div>
      </div>
    </MessageScrollerProvider>
  );
}
