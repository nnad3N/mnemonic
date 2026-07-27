import { TanStackDevtools } from "@tanstack/react-devtools";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { GTProvider, getTranslationsSnapshot, initializeGT, parseLocale } from "gt-tanstack-start";
import { useEffect } from "react";

import { ErrorComponent } from "@/components/route-components/error";
import { NotFoundComponent } from "@/components/route-components/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/better-auth/auth-client";
import TanStackQueryDevtools from "@/lib/tanstack-query/devtools";
import type { RouterContext } from "@/lib/tanstack-query/root-provider";
import loadTranslations from "@/loadTranslations";
import { authKeys, authSessionQuery } from "@/routes/_auth/-auth.api";

import gtConfig from "../../gt.config.json";

import appCss from "@/styles.css?url";

initializeGT({
  ...gtConfig,
  loadTranslations,
});

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
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
  loader: async () => {
    const locale = parseLocale();

    return {
      locale,
      translations: await getTranslationsSnapshot(locale),
    };
  },
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
    if (isPending || isRefetching) return;

    queryClient.setQueryData(authKeys.session(), { data, error });
    void router.invalidate();
  }, [data, error, isPending, isRefetching, queryClient, router]);
};

function RootDocument({ children }: { children: React.ReactNode }) {
  useAuthSessionQuery();
  const { locale, translations } = Route.useLoaderData();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="overflow-hidden">
        <GTProvider locale={locale} translations={translations}>
          <ThemeProvider>
            <Toaster />
            <main className="flex h-dvh flex-col overflow-hidden">{children}</main>
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
          </ThemeProvider>
        </GTProvider>
        <Scripts />
      </body>
    </html>
  );
}
