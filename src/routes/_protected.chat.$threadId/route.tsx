import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Spinner } from "@/components/ui/spinner";
import { threadQuery } from "@/routes/_protected.chat.$threadId/-thread-api/get-thread";

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
  useSuspenseQuery(threadQuery(threadId));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Outlet />
    </div>
  );
}
