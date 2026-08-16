import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, createFileRoute, useNavigate } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";
import { getOrCreateLatestConversation } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";
import { byokQueries, createMyByok } from "@/routes/_protected.settings/-byok.functions";
import { OpenrouterKeyForm } from "@/routes/_protected.settings/-provider-key-form";

export const Route = createFileRoute("/_protected/")({
  component: RouteComponent,
  loader: async ({ context }) => {
    const byoks = await context.queryClient.ensureQueryData({
      ...byokQueries.mine(),
      revalidateIfStale: true,
    });

    if (byoks.length === 0) {
      return { threadId: null };
    }

    const conversation = await getOrCreateLatestConversation();

    if (conversation.created) {
      await context.queryClient.invalidateQueries({
        queryKey: threadKeys.sidebarThreads(undefined),
      });
    }

    return { threadId: conversation.id };
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
  const { threadId } = Route.useLoaderData();

  if (threadId) {
    return <Navigate params={{ threadId }} replace to="/chat/$threadId" />;
  }

  return <Onboarding />;
}

const Onboarding = () => {
  const gt = useGT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createKey = useMutation({
    mutationFn: async (input: { key: string; name: string }) => {
      await createMyByok({ data: { key: input.key, name: input.name } });
      await queryClient.invalidateQueries({ queryKey: byokQueries.all() });
      const conversation = await getOrCreateLatestConversation();

      if (conversation.created) {
        await queryClient.invalidateQueries({
          queryKey: threadKeys.sidebarThreads(undefined),
        });
      }

      await navigate({
        params: { threadId: conversation.id },
        replace: true,
        to: "/chat/$threadId",
      });
    },
    onError: () => {
      toast.error(gt("Could not add API key"));
    },
  });

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-medium">
            <T>Connect OpenRouter</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Mnemonic uses your own OpenRouter API key to run its models.</T>
          </p>
        </div>
        <OpenrouterKeyForm onSubmit={async (input) => createKey.mutateAsync(input)}>
          <T>Get started</T>
        </OpenrouterKeyForm>
      </div>
    </div>
  );
};
