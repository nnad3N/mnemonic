import { queryOptions } from "@tanstack/react-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/lib/better-auth/auth";
import { authClient } from "@/lib/better-auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

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

export const authSessionQuery = queryOptions({
  queryFn: async () => {
    const response = await getAuthSession();

    if (response.error !== null) {
      throw toAuthError(response.error);
    }

    return response;
  },
  queryKey: authKeys.session(),
  staleTime: Infinity,
});
