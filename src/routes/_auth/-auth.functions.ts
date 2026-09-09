import { queryOptions } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { authClient } from "@/lib/better-auth/auth-client";
import { auth } from "@/lib/better-auth/auth.server";
import { toAuthError } from "@/lib/errors/auth-error";

export const getAuthSession = createIsomorphicFn()
  .server(async () => {
    const data = await auth.api.getSession({
      headers: getRequestHeaders(),
    });

    return {
      data,
      error: null,
    };
  })
  .client(async () => {
    const response = await authClient.getSession();

    return response;
  });

export const authQueries = {
  all: () => ["auth"] as const,
  session: () =>
    queryOptions({
      queryFn: async () => {
        const response = await getAuthSession();

        if (response.error) {
          throw toAuthError(response.error);
        }

        return response;
      },
      queryKey: [...authQueries.all(), "session"] as const,
      staleTime: Infinity,
    }),
};
