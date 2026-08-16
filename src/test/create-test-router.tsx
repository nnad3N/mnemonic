import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { RootAppShell } from "@/routes/__root";
import { authSessionQuery } from "@/routes/_auth/-auth.api";
import {
  sidebarThreadsQuery,
  sidebarTopicsQuery,
} from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";
import { byokQueries } from "@/routes/_protected.settings/-byok.functions";
import type { ByokItem } from "@/routes/_protected.settings/-byok.functions";
import { routeTree } from "@/routeTree.gen";

import { createTestQueryClient } from "./create-test-query-client";
import { testAuthSession } from "./fixtures/session";
import type { TestAuthSession } from "./fixtures/session";

type CreateTestRouterOptions = {
  queryClient: QueryClient;
  session: TestAuthSession["session"];
  user: TestAuthSession["user"];
};

type TestDocumentShellProps = {
  children: ReactNode;
  queryClient: QueryClient;
};

/**
 * Production `RootAppShell` under a QueryClientProvider (Start's Wrap equivalent).
 * Skips `<html>`/`<body>`/devtools; `body.overflow-hidden` is in `setup-browser.ts`.
 */
const TestDocumentShell = ({ children, queryClient }: TestDocumentShellProps) => (
  <QueryClientProvider client={queryClient}>
    <RootAppShell>{children}</RootAppShell>
  </QueryClientProvider>
);

/**
 * Test router from the generated file route tree — same ids/paths as production.
 *
 * Starts at `/`. Navigate to a chat route when the test needs chat context.
 */
export const createTestRouter = ({ queryClient, session, user }: CreateTestRouterOptions) => {
  queryClient.setQueryData(authSessionQuery.queryKey, {
    data: { session, user },
    error: null,
  });
  queryClient.setQueryData(sidebarThreadsQuery(undefined).queryKey, []);
  queryClient.setQueryData(sidebarTopicsQuery().queryKey, []);
  queryClient.setQueryData(byokQueries.mine().queryKey, [
    {
      active: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      id: "byok_test",
      keyPreview: "test",
      name: "OpenRouter",
    } satisfies ByokItem,
  ]);

  // `update()`'s public type omits Start's `shellComponent`; set it on the live options.
  Object.assign(routeTree.options, {
    shellComponent: ({ children }: { children: ReactNode }) => (
      <TestDocumentShell queryClient={queryClient}>{children}</TestDocumentShell>
    ),
  });

  return createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/"],
    }),
    context: {
      queryClient,
      session,
      user,
    },
    defaultPendingMinMs: 0,
  });
};

export type TestRouter = ReturnType<typeof createTestRouter>;

type CreateProviderTreeOptions = {
  /** Caller owns cache fixtures — seed with `queryOptions` + `setQueryData` before render. */
  queryClient?: QueryClient;
};

/** Router tree with providers from the test shell. Mount via RTL or vitest-browser-react `render`. */
export const createProviderTree = ({
  queryClient = createTestQueryClient(),
}: CreateProviderTreeOptions = {}) => {
  const { session, user } = testAuthSession;
  const router = createTestRouter({ queryClient, session, user });

  return {
    queryClient,
    router,
    session,
    tree: <RouterProvider router={router} />,
    user,
  };
};
