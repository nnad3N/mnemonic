import { useChat } from "@ai-sdk/react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";

import { Spinner } from "@/components/ui/spinner";
import { threadQuery } from "@/routes/_protected.chat.$threadId/-thread.api/get-thread";

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
  const { threadId } = Route.useParams();
  const { data } = useSuspenseQuery(threadQuery(threadId));

  const chat = useChat({
    id: threadId,
    messages: data.messages,
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: (options) => ({
        body: {
          ...options,
          resourceId: data.resourceId,
          threadId,
        },
      }),
    }),
  });
  const runtime = useAISDKRuntime(chat);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AssistantRuntimeProvider runtime={runtime}>
        <Outlet />
      </AssistantRuntimeProvider>
    </div>
  );
}
