import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { Session, User } from "better-auth";
import type { ReactElement, ReactNode } from "react";

import { authSessionQuery } from "@/routes/_auth/-auth.api";
import { routeTree } from "@/routeTree.gen";

type CreateTestRouterOptions = {
  queryClient: QueryClient;
  session: Session;
  user: User;
};

type TestDocumentShellProps = {
  children: ReactNode;
};

// Passthrough for Start's root `shellComponent` so tests don't mount `<html>` / auth hooks.
const TestDocumentShell = ({ children }: TestDocumentShellProps): ReactElement => <>{children}</>;

/**
 * Test router from the generated file route tree — same ids/paths as production.
 *
 * Starts at `/`. Navigate to a chat route when the test needs chat context.
 *
 * Replaces the Start document `shellComponent` (`<html>` + `authClient.useSession`)
 * with a passthrough so component SSR/hydrate tests can mount into a container.
 * Root `beforeLoad` / loaders still run.
 */
export const createTestRouter = ({
  queryClient,
  session,
  user,
}: CreateTestRouterOptions) => {
  queryClient.setQueryData(authSessionQuery.queryKey, {
    data: { session, user },
    error: null,
  });

  // `update()`'s public type omits Start's `shellComponent`; set it on the live options.
  Object.assign(routeTree.options, { shellComponent: TestDocumentShell });

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
