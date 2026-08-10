import { createFileRoute } from "@tanstack/react-router";

import { PasskeysSection } from "@/routes/_protected.settings/-passkeys-section";
import { SessionsSection } from "@/routes/_protected.settings/-sessions-section";

export const Route = createFileRoute("/_protected/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  const currentSessionId = Route.useRouteContext({ select: (context) => context.session.id });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 md:gap-6 md:p-6">
      <PasskeysSection />
      <SessionsSection currentSessionId={currentSessionId} />
    </div>
  );
}
