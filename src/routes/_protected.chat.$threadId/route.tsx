import { createFileRoute, Outlet } from "@tanstack/react-router";
import { getGT } from "gt-tanstack-start";
import { PlateController } from "platejs/react";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerProvider,
} from "@/components/ui/message-scroller";
import { ServerFnError } from "@/lib/errors/server-fn-error";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";
import { threadSettingsQueries } from "@/routes/_protected.chat.$threadId/-thread-api/thread-settings.functions";
import {
  createConversation,
  createTopicThread,
} from "@/routes/_protected.chat.$threadId/-thread-api/thread.functions";
import { ThreadComposer } from "@/routes/_protected.chat.$threadId/-thread-components/composer/thread-composer";

export const Route = createFileRoute("/_protected/chat/$threadId")({
  component: RouteComponent,
  beforeLoad: async ({ context, params, search }) => {
    try {
      await context.queryClient.ensureQueryData(threadSettingsQueries.byThread(params.threadId));
      return;
    } catch (error) {
      if (!ServerFnError.is(error) || error.status !== "not-found") {
        throw error;
      }
    }

    const gt = await getGT();
    const title = gt("New thread");

    if (search.topic) {
      await createTopicThread({
        data: {
          id: params.threadId,
          title,
          topicId: search.topic,
        },
      });
    } else {
      await createConversation({
        data: {
          id: params.threadId,
          title,
        },
      });
    }

    await Promise.all([
      context.queryClient.invalidateQueries({
        queryKey: sidebarQueries.threads(search.topic).queryKey,
      }),
      context.queryClient.prefetchQuery(threadSettingsQueries.byThread(params.threadId)),
    ]);
  },
});

function RouteComponent() {
  const threadId = Route.useParams({ select: (params) => params.threadId });

  return (
    <PlateController>
      <MessageScrollerProvider autoScroll defaultScrollPosition="end" key={threadId}>
        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
          <MessageScroller className="min-h-0 flex-1">
            <Outlet />
            <MessageScrollerButton />
          </MessageScroller>

          <div className="relative mx-auto flex w-full max-w-3xl justify-center px-2 pb-3">
            <ThreadComposer location="main" />
          </div>
        </div>
      </MessageScrollerProvider>
    </PlateController>
  );
}
