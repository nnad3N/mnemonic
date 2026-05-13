import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/search")({
  component: RouteComponent,
});

// oxlint-disable-next-line func-style
function RouteComponent() {
  return <div>Hello "/_protected/search"!</div>;
}
