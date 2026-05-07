import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { authClient } from "@/lib/auth-client";
import { auth } from "@/server/auth";

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
