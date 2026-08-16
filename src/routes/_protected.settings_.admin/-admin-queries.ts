import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@/lib/better-auth/auth-client";
import { duration } from "@/lib/durations";
import { toAuthError } from "@/lib/errors/auth-error";

export const ADMIN_USERS_PAGE_SIZE = 20;

export const adminQueries = {
  all: () => ["admin"] as const,
  user: (userId: string) =>
    queryOptions({
      queryFn: async () => {
        const response = await authClient.admin.getUser({ query: { id: userId } });

        if (response.error) {
          throw toAuthError(response.error);
        }

        return response.data;
      },
      queryKey: [...adminQueries.all(), "user", userId] as const,
      staleTime: duration.FIVE.MINUTES,
    }),
  users: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const response = await authClient.admin.listUsers({
          query: {
            limit: ADMIN_USERS_PAGE_SIZE,
            offset: (page - 1) * ADMIN_USERS_PAGE_SIZE,
            sortBy: "createdAt",
            sortDirection: "desc",
          },
        });

        if (response.error) {
          throw toAuthError(response.error);
        }

        return response.data;
      },
      queryKey: [...adminQueries.all(), "users", page] as const,
      staleTime: duration.FIVE.MINUTES,
    }),
};
