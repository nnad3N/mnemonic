import { queryOptions } from "@tanstack/react-query";

import { toAuthError } from "@/lib/errors/auth-error";
import { getAuthSession } from "@/server/get-session.api";

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

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
