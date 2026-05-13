import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

export const Route = createFileRoute("/_protected/chat/$threadId")({
  component: RouteComponent,
});

// oxlint-disable-next-line func-style
function RouteComponent() {
  const { threadId } = Route.useParams();
  const userId = Route.useRouteContext({
    select: (context) => context.user.id,
  });
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
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
    [threadId, userId]
  );
  const runtime = useChatRuntime({ transport });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Outlet />
    </AssistantRuntimeProvider>
  );
}
