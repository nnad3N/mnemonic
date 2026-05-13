import { TanStackDevtools } from "@tanstack/react-devtools";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";

import { ErrorComponent } from "@/components/route-components/error";
import { NotFoundComponent } from "@/components/route-components/not-found";
import { ToastProvider } from "@/components/ui/toast";
import { authClient } from "@/lib/better-auth/auth-client";
import PostHogProvider from "@/lib/posthog/provider";
import TanStackQueryDevtools from "@/lib/tanstack-query/devtools";
import type { RouterContext } from "@/lib/tanstack-query/root-provider";
import { getLocale } from "@/paraglide/runtime";
import { authKeys, authSessionQuery } from "@/routes/_auth/-auth.api";

import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    // Other redirect strategies are possible; see
    // https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#offline-redirect
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", getLocale());
    }

    const session = await context.queryClient.ensureQueryData(authSessionQuery);

    return { session: session?.data?.session, user: session?.data?.user };
  },
  errorComponent: ErrorComponent,
  head: () => ({
    links: [
      {
        href: appCss,
        rel: "stylesheet",
      },
    ],
    meta: [
      {
        charSet: "utf-8",
      },
      {
        content: "width=device-width, initial-scale=1",
        name: "viewport",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
  }),
  notFoundComponent: NotFoundComponent,
  shellComponent: RootDocument,
});

/**
 * Mirrors Better Auth's reactive session (`useSession`, documented client hook) into the
 * TanStack Query cache populated via `getSession` (documented for React Query).
 *
 * @see https://www.better-auth.com/docs/basic-usage#get-session — `getSession` + TanStack Query
 * @see https://www.better-auth.com/docs/basic-usage#use-session — reactive session on the client
 */
export const useAuthSessionQuery = (): void => {
  useSuspenseQuery(authSessionQuery);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, error, isPending, isRefetching } = authClient.useSession();

  useEffect(() => {
    if (isPending || isRefetching) {
      return;
    }

    queryClient.setQueryData(authKeys.session(), { data, error });
    void router.invalidate();
  }, [data, error, isPending, isRefetching, queryClient, router]);
};

// oxlint-disable-next-line func-style
function RootDocument({ children }: { children: React.ReactNode }) {
  useAuthSessionQuery();

  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        <PostHogProvider>
          <ToastProvider>
            <main className="flex min-h-dvh items-center justify-center">
              {children}
            </main>
            <TanStackDevtools
              config={{
                position: "bottom-right",
              }}
              plugins={[
                {
                  name: "Tanstack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
                TanStackQueryDevtools,
              ]}
            />
          </ToastProvider>
        </PostHogProvider>
        <Scripts />
      </body>
    </html>
  );
}
