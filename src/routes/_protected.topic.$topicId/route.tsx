import { createFileRoute, Outlet } from "@tanstack/react-router";

import { PageContent } from "@/components/page-content";
import { FilesSync } from "@/routes/_protected.topic.$topicId/-topic-components/files-sync";

export const Route = createFileRoute("/_protected/topic/$topicId")({
  component: RouteComponent,
});

function RouteComponent() {
  const topicId = Route.useParams({ select: (params) => params.topicId });

  return (
    <PageContent>
      <FilesSync topicId={topicId} />
      <Outlet />
    </PageContent>
  );
}
