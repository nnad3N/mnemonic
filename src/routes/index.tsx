import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: RouteComponent });

/* oxlint-disable func-style */
function RouteComponent() {
  return <Navigate to="/chat" />;
}
