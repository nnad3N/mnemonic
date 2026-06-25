import { createFileRoute, Outlet } from "@tanstack/react-router";

import { ArtifactsSync } from "@/routes/_protected.topic.$topicId/-topic-components/artifacts-sync";

export const Route = createFileRoute("/_protected/topic/$topicId")({
  component: RouteComponent,
});

/* oxlint-disable func-style */
function RouteComponent() {
  const topicId = Route.useParams({ select: (params) => params.topicId });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto p-6">
      <ArtifactsSync topicId={topicId} />
      <Outlet />
    </div>
  );
}
