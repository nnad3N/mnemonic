import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { GTProvider } from "gt-tanstack-start";
import type { ReactElement, ReactNode } from "react";

import { ThemeProvider } from "@/components/theme-provider";

import { createProviderTree } from "./create-test-router";
import { createTestQueryClient } from "./create-test-query-client";
import { testTranslations } from "./translations";

type AppProvidersProps = {
  children: ReactNode;
  queryClient: QueryClient;
};

/** Providers for isolated component renders (no router). Prefer `renderWithProviders` for routes. */
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

/** Render UI under app providers without a router. */
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

type RenderWithProvidersOptions = {
  queryClient?: QueryClient;
} & Omit<RenderOptions, "wrapper">;

/** Mount the real route tree (providers come from the test router shell). */
export const renderWithProviders = ({
  queryClient,
  ...renderOptions
}: RenderWithProvidersOptions = {}) => {
  const providers = createProviderTree({
    queryClient,
  });

  return {
    ...rtlRender(providers.tree, renderOptions),
    queryClient: providers.queryClient,
    router: providers.router,
    session: providers.session,
    user: providers.user,
  };
};
