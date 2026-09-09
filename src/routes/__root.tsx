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
import { enableMapSet } from "immer";
import { useEffect, type PropsWithChildren } from "react";

import { ErrorComponent } from "@/components/route-components/error";
import { NotFoundComponent } from "@/components/route-components/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { authClient } from "@/lib/better-auth/auth-client";
import TanStackQueryDevtools from "@/lib/tanstack-query/devtools";
import type { RouterContext } from "@/lib/tanstack-query/root-provider";
import loadTranslations from "@/load-translations";
import { authQueries } from "@/routes/_auth/-auth.functions";

import gtConfig from "../../gt.config.json";

import appCss from "@/styles.css?url";

enableMapSet();

initializeGT({
  ...gtConfig,
  loadTranslations,
});

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData({
      ...authQueries.session(),
      revalidateIfStale: true,
    });

    return { session: session.data?.session, user: session.data?.user };
  },
  errorComponent: ErrorComponent,
  head: () => ({
    links: [
      {
        href: appCss,
        rel: "stylesheet",
      },
      {
        href: "/manifest.json",
        rel: "manifest",
      },
      {
        href: "/icon.svg",
        rel: "icon",
        type: "image/svg+xml",
      },
      {
        href: "/apple-touch-icon.png",
        rel: "apple-touch-icon",
      },
    ],
    meta: [
      {
        charSet: "utf-8",
      },
      {
        // viewport-fit=cover is what makes env(safe-area-inset-*) report anything but zero.
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
        name: "viewport",
      },
      {
        content: "black-translucent",
        name: "apple-mobile-web-app-status-bar-style",
      },
      {
        title: "Mnemonic",
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
const useAuthSessionQuery = (): void => {
  useSuspenseQuery(authQueries.session());
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, isRefetching } = authClient.useSession();

  useEffect(() => {
    if (isPending || isRefetching) return;

    // The cached session is the identity the whole cache was populated under (query keys
    // carry no user id), so when the live session disagrees every cached query belongs to
    // someone else — nuke it all. Better Auth reports sign-out, sign-in, and cross-tab
    // session changes through `useSession`, making this the single boundary for all of them.
    const cached = queryClient.getQueryData(authQueries.session().queryKey);

    if ((cached?.data?.user.id ?? null) !== (data?.user.id ?? null)) {
      queryClient.clear();
    }

    queryClient.setQueryData(authQueries.session().queryKey, { data, error: null });
    void router.invalidate();
  }, [data, isPending, isRefetching, queryClient, router]);
};

const OFFLINE_CACHE = "mnemonic-offline";
const OFFLINE_URL = "/offline";

/**
 * Refreshed on every load rather than at service worker install, so the cached copy tracks
 * deploys without `sw.js` ever needing a version bump. Credentials are omitted so the cached
 * document never embeds the dehydrated session. The stylesheet has to come along, since by
 * definition nothing can be fetched when the document is served offline.
 */
const refreshOfflineCache = async () => {
  const response = await fetch(OFFLINE_URL, { credentials: "omit" });

  if (!response.ok) return;

  const html = new DOMParser().parseFromString(await response.clone().text(), "text/html");
  const stylesheets = [...html.querySelectorAll("link[rel=stylesheet]")]
    .map((link) => link.getAttribute("href"))
    .filter((href) => href !== null);

  const cache = await caches.open(OFFLINE_CACHE);
  await cache.put(OFFLINE_URL, response);
  await cache.addAll(stylesheets);

  const kept = [OFFLINE_URL, ...stylesheets].map(
    (path) => new URL(path, window.location.origin).href,
  );

  for (const cached of await cache.keys()) {
    if (!kept.includes(cached.url)) {
      await cache.delete(cached.url);
    }
  }
};

export const RootAppShell = ({ children }: PropsWithChildren) => {
  useAuthSessionQuery();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js");
    void refreshOfflineCache();
  }, []);
  const { locale, translations } = Route.useLoaderData();

  return (
    <GTProvider locale={locale} translations={translations}>
      <ThemeProvider>
        <Toaster />
        <main className="flex h-dvh flex-col overflow-hidden pt-(--safe-top) pr-(--safe-right) pb-(--safe-bottom) pl-(--safe-left)">
          {children}
        </main>
      </ThemeProvider>
    </GTProvider>
  );
};

function RootDocument({ children }: { children: React.ReactNode }) {
  const { locale } = Route.useLoaderData();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/*
          Not in `head()`: HeadContent keys meta by `name`, so the pair collapses to one tag.
          Both are needed because the theme is `system` by default.
        */}
        <meta content="#fffcf0" media="(prefers-color-scheme: light)" name="theme-color" />
        <meta content="#100f0f" media="(prefers-color-scheme: dark)" name="theme-color" />
        <HeadContent />
      </head>
      {/* Mermaid diagrams overflow the body while loading. */}
      <body className="overflow-hidden">
        <RootAppShell>{children}</RootAppShell>
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
        <Scripts />
      </body>
    </html>
  );
}
