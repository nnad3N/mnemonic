import { createFileRoute, Outlet } from "@tanstack/react-router";

import { FilesSync } from "@/routes/_protected.topic.$topicId/-topic-components/files-sync";

export const Route = createFileRoute("/_protected/topic/$topicId")({
  component: RouteComponent,
});

function RouteComponent() {
  const topicId = Route.useParams({ select: (params) => params.topicId });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto p-6">
      <FilesSync topicId={topicId} />
      <Outlet />
    </div>
  );
}
