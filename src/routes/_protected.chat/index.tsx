import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/chat/")({
  component: RouteComponent,
});

/* oxlint-disable func-style */
function RouteComponent() {
  const email = Route.useRouteContext({ select: (c) => c.user.email });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Chat</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Sample protected page. Signed in as{" "}
        <span className="font-medium text-neutral-900 dark:text-neutral-100">
          {email}
        </span>
        .
      </p>
    </div>
  );
}
