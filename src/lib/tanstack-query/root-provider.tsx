import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { Session, User } from "better-auth";

export type RouterContext = {
  queryClient: QueryClient;
  session: Session | undefined;
  user: User | undefined;
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters
const logCacheError = (error: unknown) => {
  console.error(error);
};

export const getContext = (): RouterContext => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: logCacheError,
    }),
    mutationCache: new MutationCache({
      onError: logCacheError,
    }),
  });

  return {
    queryClient,
    session: undefined,
    user: undefined,
  };
};
