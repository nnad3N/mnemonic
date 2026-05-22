import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";

import { threadMessagesQuery } from "@/routes/_protected.chat.$threadId/-thread.api/thread-messages";

export const Route = createFileRoute("/_protected/chat/$threadId")({
  component: RouteComponent,
});

/* oxlint-disable func-style */
function RouteComponent() {
  const { threadId } = Route.useParams();
  const userId = Route.useRouteContext({
    select: (context) => context.user.id,
  });
  const { data: messages } = useSuspenseQuery(threadMessagesQuery(threadId));
  const runtime = useChatRuntime({
    messages,
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: (options) => ({
        body: {
          id: threadId,
          messageId: options.messageId,
          messages: options.messages,
          metadata: options.requestMetadata,
          resourceId: userId,
          threadId,
          trigger: options.trigger,
        },
      }),
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Outlet />
    </AssistantRuntimeProvider>
  );
}
