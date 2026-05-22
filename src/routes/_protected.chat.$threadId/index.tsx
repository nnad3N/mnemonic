import { createFileRoute } from "@tanstack/react-router";

import { Thread } from "@/components/assistant-ui/thread";

export const Route = createFileRoute("/_protected/chat/$threadId/")({
  component: RouteComponent,
});

// oxlint-disable-next-line func-style
function RouteComponent() {
  return (
    <div className="h-full min-h-0">
      <Thread />
    </div>
  );
}
