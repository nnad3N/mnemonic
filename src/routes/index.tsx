import { Navigate, createFileRoute, redirect } from "@tanstack/react-router";

import { Spinner } from "@/components/ui/spinner";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";
import { getOrCreateLatestConversation } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (!context.user || !context.session) {
      throw redirect({ to: "/sign-in" });
    }
  },
  component: RouteComponent,
  loader: async ({ context }) => {
    const conversation = await getOrCreateLatestConversation();

    if (conversation.created) {
      await context.queryClient.invalidateQueries({
        queryKey: threadKeys.sidebarThreads(undefined),
      });
    }

    return conversation;
  },
  pendingComponent: () => {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  },
  pendingMinMs: 0,
});

function RouteComponent() {
  const { id: threadId } = Route.useLoaderData();

  return <Navigate params={{ threadId }} replace to="/chat/$threadId" />;
}
