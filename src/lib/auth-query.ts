import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

export const authSessionQuery = queryOptions({
  queryFn: async () => {
    const response = await authClient.getSession();
    return response;
  },
  queryKey: authKeys.session(),
  staleTime: Infinity,
});
