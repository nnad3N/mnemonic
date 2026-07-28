import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render as rtlRender } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import type { Session, User } from "better-auth";
import { GTProvider } from "gt-tanstack-start";
import type { ReactElement, ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";

import { createTestRouter } from "./create-test-router";
import { createTestQueryClient } from "./create-test-query-client";
import { createTestSession } from "./fixtures/session";
import { testTranslations } from "./translations";

type AppProvidersProps = {
  children: ReactNode;
  queryClient: QueryClient;
};

/** Shared app shell — keep in sync when production providers change. */
const AppProviders = ({ children, queryClient }: AppProvidersProps) => (
  <QueryClientProvider client={queryClient}>
    <GTProvider locale="en" translations={testTranslations}>
      <ThemeProvider defaultTheme="light" enableSystem={false}>
        {children}
      </ThemeProvider>
    </GTProvider>
  </QueryClientProvider>
);

type CustomRenderOptions = {
  queryClient?: QueryClient;
} & Omit<RenderOptions, "wrapper">;

/** Render UI under the shared app providers. */
export const render = (
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions }: CustomRenderOptions = {},
) => ({
  ...rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AppProviders queryClient={queryClient}>{children}</AppProviders>
    ),
    ...renderOptions,
  }),
  queryClient,
});

type ProviderTreeOptions = {
  /** Caller owns cache fixtures — seed with `queryOptions` + `setQueryData` before render. */
  queryClient?: QueryClient;
  session?: Session;
  user?: User;
};

type ProviderTreeResult = {
  queryClient: QueryClient;
  router: ReturnType<typeof createTestRouter>;
  session: Session;
  tree: ReactElement;
  user: User;
};

export const createProviderTree = ({
  queryClient = createTestQueryClient(),
  session: sessionOverride,
  user: userOverride,
}: ProviderTreeOptions = {}): ProviderTreeResult => {
  const { session, user } = createTestSession({
    ...sessionOverride,
    user: userOverride,
  });

  const router = createTestRouter({
    queryClient,
    session,
    user,
  });

  const tree = (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );

  return {
    queryClient,
    router,
    session,
    tree,
    user,
  };
};

type RenderWithProvidersOptions = ProviderTreeOptions & Omit<RenderOptions, "wrapper">;

export const renderWithProviders = ({
  queryClient,
  session,
  user,
  ...renderOptions
}: RenderWithProvidersOptions = {}) => {
  const providers = createProviderTree({
    queryClient,
    session,
    user,
  });

  return {
    ...rtlRender(providers.tree, renderOptions),
    queryClient: providers.queryClient,
    router: providers.router,
    session: providers.session,
    user: providers.user,
  };
};
