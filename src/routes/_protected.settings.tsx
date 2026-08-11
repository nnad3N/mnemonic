import { createFileRoute } from "@tanstack/react-router";

import { PageContent } from "@/components/page-content";
import { PasskeysSection } from "@/routes/_protected.settings/-passkeys-section";
import { SessionsSection } from "@/routes/_protected.settings/-sessions-section";

export const Route = createFileRoute("/_protected/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  const currentSessionId = Route.useRouteContext({ select: (context) => context.session.id });

  return (
    <PageContent className="gap-3">
      <PasskeysSection />
      <SessionsSection currentSessionId={currentSessionId} />
    </PageContent>
  );
}
