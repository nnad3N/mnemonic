import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/chat/$threadId")({
  component: RouteComponent,
});

// oxlint-disable-next-line func-style
function RouteComponent() {
  const runtime = useChatRuntime();

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Outlet />
    </AssistantRuntimeProvider>
  );
}
