import { QueryClient } from "@tanstack/react-query";
import type { Session, User } from "better-auth";

export type RouterContext = {
  queryClient: QueryClient;
  session: Session | undefined;
  user: User | undefined;
};

export const getContext = (): RouterContext => {
  const queryClient = new QueryClient();

  return {
    queryClient,
    session: undefined,
    user: undefined,
  };
};
