import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/topic/$topicId")({
  component: RouteComponent,
});

/* oxlint-disable func-style */
function RouteComponent() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto p-6">
      <Outlet />
    </div>
  );
}
